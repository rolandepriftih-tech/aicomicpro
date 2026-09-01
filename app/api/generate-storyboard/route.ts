import { NextRequest, NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { extractJsonFromLlmOutput } from "@/lib/json-repair";
import { getErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GEMINI_TIMEOUT_MS = 45_000;

type GenerateStoryboardBody = {
  script: string;
  lockedAssets: unknown;
  mode: 1 | 2 | 3;
  apiKey: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  baseUrl?: string;
  aspectRatio?: string;
  style?: string;
};

export async function POST(request: NextRequest) {
  let body: GenerateStoryboardBody;
  try {
    body = (await request.json()) as GenerateStoryboardBody;
  } catch {
    return NextResponse.json(
      { error: "请求体必须是合法的 JSON。" },
      { status: 400 }
    );
  }

  const { script, lockedAssets, mode, apiKey } = body;
  const textProvider = body.textProvider ?? "gemini";
  const textModel = body.textModel?.trim() || "gemini-2.5-pro";

  const scriptText = typeof script === "string" ? script.trim() : "";
  if (!scriptText) {
    return NextResponse.json(
      { error: "缺少剧本内容（script）。" },
      { status: 400 }
    );
  }
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json(
      { error: "缺少 API Key（apiKey）。" },
      { status: 401 }
    );
  }
  if (mode !== 1 && mode !== 2 && mode !== 3) {
    return NextResponse.json(
      { error: "无效的分镜模式（mode 必须是 1/2/3）。" },
      { status: 400 }
    );
  }

  const assetsPayload =
    lockedAssets != null && typeof lockedAssets === "object"
      ? JSON.stringify(lockedAssets, null, 2)
      : "[]";

  const systemPrompt = `你现在是好莱坞顶级摄影指导 (DP)、动作指导、场记和分镜画师。你需要将剧本转化为带时间轴、极其注重物理连贯性、且完美映射定妆资产的工业级镜头脚本。`;

  const userPrompt = `【当前输入参数】
- 分镜模式 mode: ${mode} （1：忠实原著；2：爆款编导；3：连贯强化/宫格模式）

【已定妆资产 lockedAssets（JSON）】
以下是用户已经在前期定妆环节锁定的资产（包含资产名、中文描述和可能的图片 URL）。你在拆解分镜和撰写英文提示词时，必须严格围绕这些资产进行映射，避免角色或场景在不同镜头中“变样”：
${assetsPayload}

【剧本原文 script】
${scriptText}

========================
一、制片铁律（四大核心引擎）
========================

1）时间法则：
- 每个镜头 (panel) 的 duration 必须严格控制在 5 到 15 秒之间。
- timeRange 字段必须与 duration 对齐，例如 "0s - 8s" 且 duration = 8。

2）场记连贯自检：
- 你必须在 continuityCheck 中自检以下内容：
  - 空间站位是否遵守 180 度轴线（例如：A 恒在 left side, B 恒在 right side，除非明确说明有意越轴）。
  - 动作势能延续：上一镜头动作的结束姿态与当前镜头的起始姿态是否连贯。
  - 服装 / 战损状态是否继承（例如血迹、破损、道具缺失等）。
  - 时间 / 天气 / 光影是否与 meta.globalEnvironment 描述的全局环境保持一致。

3）动作张力引擎：
- 当识别到打斗/追逐/剧烈运动场景时，你必须在 englishImagePrompt 中强制加入：
  - 极具张力的运镜（如 Dynamic Dutch angle, whip pan, rapid dolly in/out）。
  - 环境破坏元素（如 flying debris, shattered glass, exploding dust）。
  - 速度感特效（motion blur, speed lines, trailing afterimages）。
  - 生理细节（如 sweat droplets, heavy breathing, tense muscles）。

【englishImagePrompt 安全合规准则】：
- 在生成 englishImagePrompt 时，必须严格遵守全年龄段广播级安全标准。
- 绝对禁止使用与过度暴露（如裸露、极其紧身且强调身体部位的衣物）、过度暴力（如大量流血、内脏外露、肢体断裂）或性暗示相关的敏感词汇。
- 对于战斗与战损画面，请使用 scratches、battle damage、sparks、dust、debris 等安全中性词汇替代血腥描述。
- 对于人物状态，请使用 focused、determined、tired、exhausted 等中性词汇，禁止出现可能引起生理或暗示性联想的敏感描述。

4）Nano Banana 2 资产映射引擎：
- 若某个镜头中使用了 lockedAssets 里的资产：
  - 在 assetsUsed 中列出该资产名称；
  - 在 englishImagePrompt 中，用英文详细描述其视觉特征（外貌、服饰、道具、材质、颜色等），以便 Nano Banana 2 能稳定生成该资产；
  - 在 imageReferences 数组中，为每个资产单独创建一条引用：
    {
      "assetName": "必须与 assetsUsed 中的名称一致",
      "referenceType": "subject 或 style",
      "weight": 1.0
    }
  - subject：表示这是画面主体角色/道具；
  - style：表示这是提供画风/环境风格参考的资产。

========================
二、三大模式拆解策略
========================

mode === 1 【忠实原著】：
- 逐句拆解原著，忠实还原剧情细节，不随意删减或重写。
- 镜头语言平稳自然，以中景/特写/基础推拉为主，重点在信息清晰度。

mode === 2 【爆款编导 / 短视频爆款专家】：
- 你是短视频平台的爆款内容专家，深谙"黄金三秒"法则。第1个 panel 必须是能在3秒内抓住观众的强 Hook：悬念、冲突、视觉奇观或反常识画面，拒绝平庸开场。
- 用「网感化」思维重写镜头节奏：前3秒强钩子 → 中段信息密度 → 结尾悬念/反转/情绪爆点。
- 使用更大胆的运镜和构图：广角、极端透视、高对比色彩和强烈光影。
- 每个 panel 必须同时输出两个提示词：
  1. \`englishImagePrompt\`：给AI生图用的高质量英文提示词
  2. \`videoPrompt\`：给可灵(Kling)等AI视频模型用的中文视频提示词，必须明确描述主体动作、镜头运动（推/拉/摇/移/跟）、时间变化、光影流转

mode === 3 【连贯强化 / 宫格模式】：
- 选择一场关键戏或连续动作，将一个动作拆解为多个连续 panel，强调时间与空间的连贯性。
- 为后续宫格分镜导出做准备：虽然本接口暂不要求输出 grid 布局，但在创作时要考虑单个镜头在九宫格或十六宫格中的可读性。

========================
三、强制 JSON Schema（只返回一个合法 JSON）
========================
**JSON 语法铁律（违反任何一条都会导致解析失败）：**
1. 所有属性名必须加双引号，例如 {"name": "value"}，绝不可以写成 {name: "value"}
2. 所有字符串值必须在一行内完成，禁止在字符串中间换行；如需换行请使用转义换行符
3. 最后一个属性后面不可以有逗号
4. 禁止输出任何 markdown 代码块标记、解释文字或注释
5. 只输出纯 JSON，从开始的大括号到最后的大括号

结构至少应为：

{
  "meta": {
    "totalDuration": "总时长预估",
    "globalEnvironment": "提取全局时间、天气和核心光影（如：雨夜，冷蓝霓虹光），后续所有分镜必须严格继承此环境",
    "stylePrefix": "全局英文画风前缀（如 Cinematic lighting, masterpiece, 8k resolution）"
  },
  "panels": [
    {
      "panelId": 1,
      "timeRange": "0s - 8s",
      "duration": 8,
      "shotSizeAndCamera": "景别与运镜 (如：Medium Shot, Slow push-in)",
      "assetsUsed": ["林风", "等离子巨剑"],
      "continuityCheck": "【场记自检】核对轴线位置、上一动作衔接、光影是否与 globalEnvironment 一致。",
      "audioCues": "BGM氛围 及 具体SFX音效",
      "transitionToNext": "转场建议 (Cut / Whip pan / Match cut 等)",
      "chineseDirectorNotes": "【给用户看】包含动作逻辑、环境互动的中文画面阐述。",
      "englishImagePrompt": "【给AI生图看】公式组装：[全局画风] + [景别机位] + [动作情绪] + [强制植入的资产特征] + [动作张力特效(若有)] + [全局环境光影].",
      "videoPrompt": "【给AI视频看 / 可灵】中文视频提示词，必须包含：主体动作描述 + 镜头运动（推/拉/摇/移/跟/旋转）+ 时间/光影变化 + 环境氛围。不要旁白式描述，要像导演对摄像师下的指令。",
      "imageReferences": [
        {
          "assetName": "资产名称(必须与assetsUsed中一致)",
          "referenceType": "subject 或 style",
          "weight": 1.0
        }
      ]
    }
  ]
}

请严格按照上述结构和规则输出 JSON。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const rawText = await callChat({
      provider: textProvider,
      baseUrl: body.baseUrl,
      apiKey: apiKey.trim(),
      model: textModel,
      messages,
      temperature: 0.7,
      timeoutMs: GEMINI_TIMEOUT_MS,
      maxTokens: 32000,
    });

    if (!rawText) {
      return NextResponse.json(
        { error: "模型未返回有效内容" },
        { status: 502 }
      );
    }

    // 打印原始输出到服务端日志，方便排查
    console.log("[generate-storyboard] rawText length:", rawText.length);
    console.log("[generate-storyboard] rawText preview:", rawText.slice(0, 500));

    // 检测内容是否被安全过滤
    const blockedKeywords = [
      "content blocked",
      "content was blocked",
      "被拦截",
      "被过滤",
      "无法生成",
      "sorry",
      "i can't",
      "i cannot",
      "unable to",
      "policy",
      "safety",
    ];
    const lowerRaw = rawText.toLowerCase();
    const isBlocked = blockedKeywords.some((kw) => lowerRaw.includes(kw));
    if (isBlocked && !rawText.trim().startsWith("{")) {
      return NextResponse.json(
        {
          error:
            "模型因内容安全策略拒绝了本次请求。请检查剧本内容是否包含敏感或违禁描述，或尝试更换模型/提供商。",
          raw: rawText.slice(0, 1200),
        },
        { status: 502 }
      );
    }

    const cleaned = extractJsonFromLlmOutput(rawText);
    console.log("[generate-storyboard] cleaned JSON preview:", cleaned.slice(0, 500));

    let data: unknown;
    try {
      data = JSON.parse(cleaned) as unknown;
    } catch (parseErr) {
      console.error("[generate-storyboard] JSON parse error:", parseErr);
      return NextResponse.json(
        {
          error: "模型返回内容无法解析为 JSON。常见原因：模型输出被截断、包含非法控制字符、或返回了非 JSON 的说明文本。",
          raw: rawText.slice(0, 1200),
        },
        { status: 502 }
      );
    }

    // 后处理：为每个 panel 兜底补充 videoPrompt，以及提取 matchedAssets
    const sb = data as { panels?: Array<Record<string, unknown>> };
    if (Array.isArray(sb.panels)) {
      for (const panel of sb.panels) {
        const imgPrompt = panel.englishImagePrompt;
        if (!panel.videoPrompt && typeof imgPrompt === "string") {
          // 用 englishImagePrompt 自动生成兜底 videoPrompt
          panel.videoPrompt =
            "【自动衍生】镜头缓缓推进，主体在画面中移动，光影随时间微妙变化。" +
            imgPrompt.slice(0, 120) +
            "...";
        }
        // 从 assetsUsed 提取 matchedAssets（供前端参考）
        const assetsUsed = panel.assetsUsed;
        if (Array.isArray(assetsUsed) && assetsUsed.length > 0) {
          panel.matchedAssets = assetsUsed;
        }
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    const raw = getErrorMessage(err);
    const isTimeout =
      /timeout|ETIMEDOUT|timed out|deadline|aborted/i.test(raw);
    const status =
      raw.includes("401") || raw.toLowerCase().includes("unauthorized")
        ? 401
        : isTimeout
          ? 504
          : 500;
    const message = isTimeout
      ? "连接超时，请确认代理已启动或网络可访问 API。"
      : raw;
    return NextResponse.json({ error: message, details: raw }, { status });
  }
}
