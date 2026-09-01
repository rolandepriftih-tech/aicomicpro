import { NextRequest, NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { DEFAULT_STYLE, getAnalysisPrefix } from "@/lib/style-config";
import { extractJsonFromLlmOutput } from "@/lib/json-repair";
import type {
  AnalyzeAssetsResponse,
  AssetCharacter,
  AssetCharacterState,
  AssetCockpit,
  AssetCreature,
  AssetProp,
  AssetPropVariant,
  AssetScene,
} from "@/types/analyze";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 单张参考图 base64 大致上限（字符数），防止请求体过大 */
const MAX_IMAGE_BASE64_CHARS = 2_800_000;

/**
 * 转义 JSON 字符串中的裸换行符（将真实 \n 替换为 \\n）。
 */
function escapeNewlinesInJsonStrings(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        result += ch;
        escaped = false;
      } else if (ch === "\\") {
        result += ch;
        escaped = true;
      } else if (ch === '"') {
        result += ch;
        inString = false;
      } else if (ch === "\n") {
        result += "\\n";
      } else if (ch === "\r") {
        // 跳过 \r，由 \n 处理
      } else {
        result += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
    }
  }
  return result;
}

/**
 * 全面修复 LLM 返回的常见 JSON 语法错误：
 * 1. 属性名缺少双引号
 * 2. 字符串中包含裸换行符
 * 3. 对象/数组尾部多余逗号
 * 4. 单引号代替双引号（简单替换）
 * 5. 截断补全
 */
function repairJson(text: string): string | null {
  let repaired = text.trim();

  // 1. 转义字符串内的真实换行符
  repaired = escapeNewlinesInJsonStrings(repaired);

  // 2. 修复对象内未加引号的属性名（中文或英文）
  // 匹配 { 或 , 后面跟着的 identifier: ，但排除前面已有引号的情况
  // 使用多次替换以处理嵌套
  for (let i = 0; i < 5; i++) {
    const next = repaired.replace(
      /([{,]\s*)([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)\s*:/g,
      '$1"$2":'
    );
    if (next === repaired) break;
    repaired = next;
  }

  // 3. 移除对象/数组末尾的多余逗号
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  // 4. 修复截断：如果最后是一个未闭合的字符串，尝试闭合
  let inStr = false;
  let esc = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
    } else if (ch === '"') {
      inStr = true;
    }
  }
  if (inStr) {
    repaired += '"';
  }

  // 5. 补全未闭合的对象和数组
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    // 找到最后一个可以安全截断的位置
    let lastComplete = Math.max(
      repaired.lastIndexOf('",'),
      repaired.lastIndexOf('"}'),
      repaired.lastIndexOf('"]'),
      repaired.lastIndexOf("true,"),
      repaired.lastIndexOf("false,"),
      repaired.lastIndexOf("null,")
    );
    const lastColon = repaired.lastIndexOf('":');
    const lastComma = repaired.lastIndexOf(",");
    if (lastComplete === -1) {
      lastComplete = Math.max(lastColon, lastComma);
    }

    if (lastComplete !== -1) {
      let base = repaired.slice(0, lastComplete + 1);
      base = base.replace(/,\s*$/, "");
      const bOpenB = (base.match(/\{/g) || []).length;
      const bCloseB = (base.match(/\}/g) || []).length;
      const bOpenK = (base.match(/\[/g) || []).length;
      const bCloseK = (base.match(/\]/g) || []).length;
      for (let i = 0; i < bOpenK - bCloseK; i++) base += "]";
      for (let i = 0; i < bOpenB - bCloseB; i++) base += "}";
      return base;
    }
  }

  // 6. 如果括号平衡但结尾异常，也尝试返回
  if (/[,:\s]$/.test(repaired)) {
    return null;
  }

  return repaired;
}

type AnalyzeRequestBody = {
  script: string;
  mode: 1 | 2 | 3;
  apiKey: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  baseUrl?: string;
  style?: string;
  /** 最多 3 张 data URL，与剧本一并送入多模态模型，用于锁画风/人设/时代感 */
  referenceImages?: string[];
};

function normalizeCharacter(raw: unknown): AssetCharacter {
  const o = raw as Record<string, unknown>;
  const statesRaw = o.states;
  let states: AssetCharacterState[] | undefined;
  if (Array.isArray(statesRaw)) {
    states = statesRaw
      .map((s) => {
        const x = s as Record<string, unknown>;
        const stateName = String(x.stateName ?? x.name ?? "").trim();
        const description = String(x.description ?? "").trim();
        if (!stateName || !description) return null;
        return { stateName, description };
      })
      .filter(Boolean) as AssetCharacterState[];
    if (states.length === 0) states = undefined;
  }
  return {
    name: String(o.name ?? "未命名角色").trim() || "未命名角色",
    description: String(o.description ?? "").trim(),
    role: String(o.role ?? "配角").trim() || "配角",
    gender: typeof o.gender === "string" ? o.gender.trim() : undefined,
    age: typeof o.age === "string" ? o.age.trim() : undefined,
    height: typeof o.height === "string" ? o.height.trim() : undefined,
    bodyType: typeof o.bodyType === "string" ? o.bodyType.trim() : undefined,
    states,
  };
}

function normalizeProp(raw: unknown): AssetProp {
  const o = raw as Record<string, unknown>;
  const variantsRaw = o.variants;
  let variants: AssetPropVariant[] | undefined;
  if (Array.isArray(variantsRaw)) {
    variants = variantsRaw
      .map((v) => {
        const x = v as Record<string, unknown>;
        const variantName = String(x.variantName ?? x.name ?? "").trim();
        const description = String(x.description ?? "").trim();
        if (!variantName || !description) return null;
        return { variantName, description };
      })
      .filter(Boolean) as AssetPropVariant[];
    if (variants.length === 0) variants = undefined;
  }
  return {
    name: String(o.name ?? "未命名道具").trim() || "未命名道具",
    description: String(o.description ?? "").trim(),
    type: typeof o.type === "string" ? o.type.trim() : undefined,
    variants,
  };
}

function normalizeCockpit(raw: unknown): AssetCockpit {
  const o = raw as Record<string, unknown>;
  return {
    name: String(o.name ?? "未命名机舱").trim() || "未命名机舱",
    description: String(o.description ?? "").trim(),
    hostAsset:
      typeof o.hostAsset === "string" && o.hostAsset.trim()
        ? o.hostAsset.trim()
        : undefined,
    occupantsHint:
      typeof o.occupantsHint === "string" && o.occupantsHint.trim()
        ? o.occupantsHint.trim()
        : undefined,
  };
}

function normalizeCreature(raw: unknown): AssetCreature {
  const o = raw as Record<string, unknown>;
  return {
    name: String(o.name ?? "未命名生物").trim() || "未命名生物",
    description: String(o.description ?? "").trim(),
    type: String(o.type ?? "生物").trim() || "生物",
  };
}

function normalizeScene(raw: unknown): AssetScene {
  const o = raw as Record<string, unknown>;
  return {
    name: String(o.name ?? "未命名场景").trim() || "未命名场景",
    description: String(o.description ?? "").trim(),
    type: typeof o.type === "string" ? o.type.trim() : undefined,
    timeOfDay: typeof o.timeOfDay === "string" ? o.timeOfDay.trim() : undefined,
    weather: typeof o.weather === "string" ? o.weather.trim() : undefined,
  };
}

/**
 * 将模型返回的松散 JSON 规整为 AnalyzeAssetsResponse，避免缺字段导致前端崩溃。
 */
function normalizeAnalyzeResponse(
  raw: Record<string, unknown>
): AnalyzeAssetsResponse {
  const characters = Array.isArray(raw.characters)
    ? raw.characters.map(normalizeCharacter)
    : [];
  const creatures = Array.isArray(raw.creatures)
    ? raw.creatures.map(normalizeCreature)
    : [];
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.map(normalizeScene) : [];
  const props = Array.isArray(raw.props) ? raw.props.map(normalizeProp) : [];
  const cockpits = Array.isArray(raw.cockpits)
    ? raw.cockpits.map(normalizeCockpit)
    : [];
  const directorNotes =
    typeof raw.directorNotes === "string" ? raw.directorNotes.trim() : "";

  return {
    characters,
    creatures,
    scenes,
    props,
    cockpits,
    directorNotes,
  };
}

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求体格式错误，必须是合法的 JSON。" },
      { status: 400 }
    );
  }

  const { script, mode, apiKey } = body;
  const textProvider = body.textProvider ?? "gemini";
  const textModel = body.textModel?.trim() || "gemini-2.5-pro";
  const referenceImages = Array.isArray(body.referenceImages)
    ? body.referenceImages.filter((x) => typeof x === "string").slice(0, 3)
    : [];

  if (!script?.trim() || script.length < 50) {
    return NextResponse.json(
      { error: "剧本内容过短，请提供至少 50 字的剧本。" },
      { status: 400 }
    );
  }
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "缺少 API Key，请在设置中配置。" },
      { status: 401 }
    );
  }
  if (![1, 2, 3].includes(mode)) {
    return NextResponse.json(
      { error: "无效的导演模式选择。" },
      { status: 400 }
    );
  }

  for (let i = 0; i < referenceImages.length; i++) {
    const url = referenceImages[i];
    if (!url.startsWith("data:")) continue;
    const parts = url.split(",");
    const base64Part = parts[1];
    if (base64Part && base64Part.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json(
        {
          error: `参考图 ${i + 1} 体积过大，请在客户端压缩后重试（建议单张 2MB 以内）。`,
        },
        { status: 413 }
      );
    }
  }

  const globalStylePrefix = getAnalysisPrefix(body.style ?? "");

  let directorStylePrompt = "";

  switch (mode) {
    case 1:
      directorStylePrompt =
        "当前制片要求：【忠实原著 (Faithful adaptation)】。请以考据般的严谨态度逐句、逐场拆解剧本，不得遗漏任何可视要素。";
      break;
    case 2:
      directorStylePrompt =
        "当前制片要求：【好莱坞商业大片 (Hollywood Blockbuster)】。在完整覆盖剧情可视要素的前提下，突出极具广告片质感的造型与奇观；机甲座舱、载具内饰、巨型道具等要能支撑大场面镜头。";
      break;
    case 3:
      directorStylePrompt =
        "当前制片要求：【文艺情绪片 (Arthouse/Atmospheric)】。细致提取光影、质感与人物微妙状态变化；机舱/车内等封闭空间需强调情绪氛围与狭小空间里的层次。";
      break;
  }

  const refImageInstruction =
    referenceImages.length > 0
      ? `\n用户另附 **${referenceImages.length}** 张参考图（见消息中的图片部分）。请结合参考图推断：画风倾向、时代感、色板、角色或场景气质，并在资产描述中与之对齐（勿复述图片内容，只把约束融入文字描述）。\n`
      : "";

  const systemPrompt = `你现在是顶级的影视前期执行导演，兼任首席视觉概念设计师。你的任务是极其细致地阅读剧本，并拆解出 AI 生图所需的**全量资产清单**。

核心原则：
1. 若剧本写过，就必须有对应条目，不得合并或省略
2. 所有资产描述必须以统一的「${globalStylePrefix}」风格前缀开头
3. 描述要足够详细，确保 GPT-Image-2 / DALL-E-3 等生图模型能直接看懂并生成
4. 每段 description 约 150-250 字，必须包含：材质、颜色、光影、特殊标记

${directorStylePrompt}`;

  const userText = `${refImageInstruction}
### 全局画风约束（所有description必须以此前缀开头）

「${globalStylePrefix}」

### 角色资产设定集规范（characters）

每位角色必须按「角色设定集」标准输出，包含：
- **name**: 角色名
- **gender**: 性别（男/女/未知）
- **age**: 年龄（数字+"岁"）
- **height**: 身高（如"168cm"）
- **bodyType**: 体型（如"纤细敏捷型"、"魁梧肌肉型"、"标准匀称型"）
- **role**: 主角/配角/反派
- **description**: 主视觉定妆描述（约250-350字），必须按「专业角色设定集（Professional Character Design Sheet）」标准输出，结构如下：
  * **构图定位**：full body standing pose, centered, character design sheet layout
  * **多角度面部研究暗示**：正面自信凝视、3/4侧面温柔微笑、侧面轮廓优雅、闭眼平和（至少暗示4个角度）
  * **头部与面部**：脸型、五官细节（眼型/眼尾/眼神、鼻梁、唇色）、发型发色、肤色与肤质
  * **服装全貌**：上衣/下装/外套/鞋靴的材质、颜色、剪裁、装饰纹样与金属配件
  * **配饰细节**：耳环、项链、腰带、手套、腕部装甲、靴扣等（注明材质与位置）
  * **特殊标记**：纹身/疤痕/发光纹路/胎记（必须注明精确位置与范围，如"右手腕延伸至前臂中段，如珠宝般环绕"）
  * **手部状态**：双手自然下垂或自然摆放，不得手持任何物品、武器、道具、法器。如剧本中该角色确实需要持有标志性道具，请在「道具资产」中单独创建条目，角色description中保持空手
  * **细节研究区域**：指定需要特写研究的部件（如腰带扣设计、靴子细节、特殊纹路近景、装甲接缝等）
  * **底部信息栏格式**：Name: [角色名], Age: [年龄], Height: [身高], Style: [画风标签]
  * **整体气质、姿态与光影**
- **states**: 【关键视觉状态数组】只保留以下类型的状态，其他细微表情不单独列出：
  * 服装显著变动（战斗服/礼服/睡衣/机甲服）→ 注意：服装变动较大时，应生成**独立角色条目**而非state
  * 战损/负伤/流血状态
  * 变身/觉醒/黑化状态
  * 驾驶/坐入机舱/密闭空间内的特殊造型
  * 湿身/泥污/烧焦等环境导致的显著外观变化
  * 年龄变化（幼年/老年闪回）

  每个state包含：stateName（如「战损·左臂负伤」）、description（完整视觉描述，约120-180字）

**重要规则**：
- 如果角色在剧本中出现**两种及以上显著不同的服装**（如日常校服 vs 战斗铠甲），不要放在states里，而是生成**两个独立的角色条目**，name分别叫「角色名·日常」和「角色名·战斗」
- 微笑、闭眼、皱眉等细微表情变化不生成states，仅在主description中提及即可

### 生物资产规范（creatures）

- **name**: 生物名
- **type**: 类型（宠物/坐骑/怪物BOSS/机械生命/神灵/异兽）
- **description**: 完整视觉描述（约150-220字），包含：
  * 整体体型与比例（与人类的对比）
  * 皮肤/毛发/鳞片/金属外壳的材质与颜色
  * 头部特征（角、獠牙、触须、复眼）
  * 肢体结构（翅膀、尾巴、爪子、足）
  * 发光部位或特殊器官
  * 与角色的互动关系

### 场景资产规范（scenes）

- **name**: 场景名
- **type**: 室内/室外/太空/水下/梦境/异空间
- **timeOfDay**: 时间（清晨/正午/黄昏/夜晚/黎明）
- **weather**: 天气（晴朗/雨天/雪天/雾天/暴风/无）
- **description**: 完整视觉描述（约250-350字），必须按「Environment Design Sheet / 场景设定集」标准输出，结构如下：
  * **构图定位**：wide angle interior/exterior view, centered, environment design sheet layout with multiple perspective studies, beautiful atmospheric composition, cinematic framing。必须明确要求包含全景正面视角、俯视鸟瞰视角、侧面纵深视角、局部细节特写四个方位研究，确保场景全方位展示空间结构
  * **绝对禁止出现人物**：场景中不得出现任何人物、角色、生物、动物。必须是纯空镜头场景（empty scene, no people, no characters, no creatures）。严禁把场景写成"角色站在..."。
  * **空间尺度与透视**：全景纵深关系、消失点方向、空间层次（前景/中景/远景各自的标志性结构）
  * **建筑与环境特征**：材质、纹理、磨损程度、标志性结构或陈设
  * **光影系统**：
    - 主光源方向与色温（如「顶部45度暖橙色侧光」）
    - 副光源/反射光/环境光颜色
    - 阴影层次与软硬程度
  * **氛围色调**：整体色板（主色+辅色+点缀色）
  * **环境粒子与特效**：雨丝、雾气、尘埃、星光、蒸汽、水面反射、霓虹光晕等
  * **细节研究区域**：指定需要特写研究的部件（如墙面纹理、地板接缝、破损细节、水面波纹、植被形态等）
  * **底部信息栏格式**：Name: [场景名], Type: [室内/室外], Time: [时间], Weather: [天气], Style: [画风标签]

### 道具资产规范（props）

- **name**: 道具名
- **type**: 武器/饰品/工具/载具/容器/法器/科技装置
- **description**: 默认形态描述（约150-220字），包含：
  * 整体形状与尺寸（与手掌/人体的对比）
  * 材质（金属/木质/水晶/生物组织/能量体）
  * 主颜色与装饰纹样
  * 发光/特效部件
  * 磨损/崭新程度
- **variants**: 关键视觉形态变化（只保留功能性形态变化，不保留颜色微调）：
  * 未启动/充能中/完全激活
  * 破损/修复后
  * 折叠/展开/变形后
  * 每个variant包含：variantName、description（完整视觉描述）

### 驾驶舱/操控空间规范（cockpits）

- **name**: 机舱/驾驶舱名
- **description**: 完整视觉描述（约180-250字），包含：
  * 控制台布局与仪表/HUD风格
  * 座椅材质与安全束缚装置
  * 舷窗或全景屏外的可见景
  * 舱内主光色温与氛围
  * 烟雾、粒子、蒸汽等环境特效
  * 可操作的关键部件（操纵杆、油门、踏板、按钮阵列）
- **hostAsset**: 关联机体或载具名
- **occupantsHint**: 常见操作者

### 文风与统一性

* **每一段 description 都必须以「${globalStylePrefix}」开头**
* name、role、stateName、variantName 等标识字段用中文
* description 内可夹英文材质词（如 brushed aluminum, carbon fiber）以利生图
* 严禁把多种状态挤在同一段 description 里
* 严禁输出任何 markdown 围栏或解释文字

### 强制输出格式（JSON 语法铁律）

**只允许**输出一个合法 JSON 字符串。结构如下：

**JSON 语法铁律（违反任何一条都会导致解析失败）：**
1. 所有属性名必须加双引号，例如 {"name": "value"}，绝不可以写成 {name: "value"}
2. 所有字符串值必须在一行内完成，禁止在字符串中间换行；如需换行请使用转义换行符
3. 最后一个属性后面不可以有逗号
4. 禁止输出任何 markdown 代码块标记、解释文字或注释
5. 只输出纯 JSON，从开始的大括号到最后的大括号

{
  "characters": [
    {
      "name": "角色名",
      "gender": "女",
      "age": "18岁",
      "height": "168cm",
      "bodyType": "纤细敏捷型",
      "role": "主角",
      "description": "${globalStylePrefix}...",
      "states": [
        { "stateName": "战损·左臂负伤", "description": "${globalStylePrefix}..." }
      ]
    }
  ],
  "creatures": [
    { "name": "生物名", "type": "坐骑", "description": "${globalStylePrefix}..." }
  ],
  "scenes": [
    { "name": "场景名", "type": "室外", "timeOfDay": "黄昏", "weather": "雨天", "description": "${globalStylePrefix}..." }
  ],
  "props": [
    {
      "name": "道具名",
      "type": "武器",
      "description": "${globalStylePrefix}...",
      "variants": [
        { "variantName": "充能形态", "description": "${globalStylePrefix}..." }
      ]
    }
  ],
  "cockpits": [
    {
      "name": "机舱名",
      "description": "${globalStylePrefix}...",
      "hostAsset": "关联载具",
      "occupantsHint": "驾驶员"
    }
  ],
  "directorNotes": "结合【${
    mode === 1 ? "忠实原著" : mode === 2 ? "好莱坞大片" : "文艺情绪"
  }】模式，总结全片视觉基调、角色一致性要点与关键 continuity 注意事项。"
}

---
**剧本原文开始：**
${script.trim()}
**剧本原文结束**
`;

  const userContent: ChatMessage["content"] = [
    { type: "text", text: userText },
    ...referenceImages.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  try {
    const rawText = await callChat({
      provider: textProvider,
      baseUrl: body.baseUrl,
      apiKey: apiKey.trim(),
      model: textModel,
      messages,
      temperature: 0.7,
      timeoutMs: 120000,
      maxTokens: 32000,
    });

    if (!rawText) {
      return NextResponse.json(
        { error: "模型未返回有效内容" },
        { status: 502 }
      );
    }

    console.log("[analyze] rawText length:", rawText.length);
    console.log("[analyze] rawText tail:", rawText.slice(-200));

    const cleanedText = extractJsonFromLlmOutput(rawText);
    console.log("[analyze] extracted JSON length:", cleanedText.length);

    let jsonResponse: Record<string, unknown>;
    try {
      jsonResponse = JSON.parse(cleanedText) as Record<string, unknown>;
    } catch (parseErr) {
      console.error("[analyze] JSON parse error:", parseErr);
      // 尝试全面修复常见的 LLM JSON 语法错误
      const repaired = repairJson(cleanedText);
      if (repaired) {
        try {
          jsonResponse = JSON.parse(repaired) as Record<string, unknown>;
          console.log("[analyze] JSON repaired and parsed successfully");
        } catch (repairErr) {
          console.error("[analyze] JSON repair failed:", repairErr);
          return NextResponse.json(
            {
              error: "AI 返回的数据格式有误，无法解析为 JSON。常见原因：属性名缺少引号、字符串内包含换行符、或模型输出被截断。",
              rawText: rawText.slice(0, 1200),
            },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: "AI 返回的数据格式有误，无法解析为 JSON。常见原因：模型输出被截断或格式严重损坏。",
            rawText: rawText.slice(0, 1200),
          },
          { status: 502 }
        );
      }
    }

    const normalized = normalizeAnalyzeResponse(jsonResponse);
    return NextResponse.json(normalized);
  } catch (error: unknown) {
    console.error("LLM API 调用失败:", error);
    const err = error as { message?: string; code?: string };

    let errorMessage = "AI 服务暂时不可用，请稍后再试。";
    let status = 500;

    if (err.message?.includes("API key")) {
      errorMessage = "API Key 无效或已过期，请检查设置。";
      status = 401;
    } else if (
      err.message?.includes("timeout") ||
      err.code === "ETIMEDOUT" ||
      err.message?.includes("超时")
    ) {
      errorMessage = "请求超时，请检查网络连接或中转站可用性。（如需代理，请设置 HTTPS_PROXY 环境变量）";
      status = 504;
    } else if (err.message?.includes("candidate")) {
      errorMessage = "AI 拒绝生成内容，可能是剧本触碰了安全策略。";
      status = 422;
    }

    return NextResponse.json(
      { error: errorMessage, details: err.message },
      { status }
    );
  }
}
