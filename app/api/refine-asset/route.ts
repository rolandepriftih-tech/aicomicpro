import { NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { getErrorMessage } from "@/lib/errors";
import { getAnalysisPrefix, getImagePrefix } from "@/lib/style-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RefineAssetBody = {
  assetName: string;
  assetType: string;
  description: string;
  instruction: string;
  style?: string;
  apiKey?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  baseUrl?: string;
};


/** 已知中文画风标签 */
const CN_STYLE_LABELS = [
  "日系动漫", "国漫", "古风", "真人/写实", "电影质感", "短剧",
  "赛博朋克", "美漫", "像素", "水墨国风", "蒸汽朋克", "哥特/暗黑",
  "卡通/Q版", "油画/古典", "科幻/未来", "复古/昭和", "王者·云缨闪卡",
];

/** 剥掉文本中所有已知画风标签 */
function stripAllStyleLabels(text: string): string {
  let t = text;
  for (const label of CN_STYLE_LABELS) {
    t = t.replace(new RegExp(`${label}风格[：:]\\s*`, "g"), "");
  }
  // 英文标签
  t = t.replace(
    /(?:anime|chinese anime|gufeng|realistic|cinematic|short drama|cyberpunk|comic|pixel|ink wash|steampunk|gothic|chibi|oil painting|sci-fi|retro) style[,：:.\s]+/gi,
    ""
  );
  return t.replace(/\s{2,}/g, " ").trim();
}

/** 道具/场景人物词汇黑名单 */
const HUMAN_KEYWORDS = [
  "人物", "角色", "人类", "人形", "人手", "手指", "手掌", "手臂",
  "脸", "面部", "脸庞", "头颅", "头部", "头", "眼睛", "眼神", "目光",
  "身体", "身躯", "躯干", "肢体", "双腿", "双脚", "姿态", "站姿",
  "坐姿", "姿势", "动作", "表情", "神情", "神色", "穿着", "衣着",
  "衣服", "服装", "服饰", "穿戴", "发型", "头发", "发饰", "发丝",
  "肌肤", "皮肤", "肤色", "面容", "五官", "嘴唇", "嘴巴", "鼻子",
  "耳朵", "脖颈", "肩膀", "胸膛", "腰部", "臀部", "腿部", "女性",
  "男性", "少女", "少年", "男子", "女子", "战士", "骑士", "刺客",
  "法师", "猎人", "将军", "士兵", "守护者", "operator", "figure",
  "person", "human", "hand", "hands", "finger", "fingers", "face",
  "facial", "head", "heads", "eye", "eyes", "body", "bodies", "posture",
  "stance", "pose", "posing", "expression", "wearing", "clothing",
  "clothes", "outfit", "hairstyle", "hair", "skin", "complexion",
];

/** 清理道具/场景描述中的人物相关词汇（兜底后处理） */
function sanitizePropScene(text: string, assetType: string): string {
  if (assetType !== "道具" && assetType !== "场景") return text;

  let result = text;
  for (const kw of HUMAN_KEYWORDS) {
    // 匹配独立词（前后是标点、空格、句首句尾）
    const regex = new RegExp(
      `(^|[，,、；;。.!！?？\\s])${kw}([，,、；;。.!！?？\\s]|$)`,
      "gi"
    );
    result = result.replace(regex, "$1$2");
  }
  // 清理多余空格和标点
  return result
    .replace(/\s{2,}/g, " ")
    .replace(/，\s*，/g, "，")
    .replace(/,\s*,/g, ",")
    .replace(/；\s*；/g, "；")
    .replace(/。\s*。/g, "。")
    .trim();
}

export async function POST(request: Request) {
  let body: RefineAssetBody;
  try {
    body = (await request.json()) as RefineAssetBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体必须是有效的 JSON" },
      { status: 400 }
    );
  }

  const {
    assetName,
    assetType,
    description,
    instruction,
    style,
    apiKey,
    textModel,
    baseUrl,
  } = body;
  const textProvider = body.textProvider ?? "gemini";
  const modelId = textModel?.trim() || "gemini-2.5-pro";

  if (!assetName?.trim()) {
    return NextResponse.json(
      { success: false, error: "缺少资产名称（assetName）" },
      { status: 400 }
    );
  }
  if (!description?.trim()) {
    return NextResponse.json(
      { success: false, error: "缺少资产描述（description）" },
      { status: 400 }
    );
  }
  if (!instruction?.trim()) {
    return NextResponse.json(
      { success: false, error: "缺少修改指令（instruction）" },
      { status: 400 }
    );
  }

  const currentApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!currentApiKey) {
    return NextResponse.json(
      { success: false, error: "未提供 API Key" },
      { status: 401 }
    );
  }

  const stylePrefix = getAnalysisPrefix(style ?? "");
  const imagePrefix = getImagePrefix(style ?? "");

  // 剥掉原描述中所有画风标签，得到纯内容
  const contentOnly = stripAllStyleLabels(description.trim());

  try {
    // 根据资产类型动态构建类型隔离提示
    const isPropOrScene = assetType === "道具" || assetType === "场景";
    const typeIsolationPrompt = isPropOrScene
      ? `\n\n【类型隔离 —— 绝对禁令】\n本资产类型为「${assetType}」。你必须严格遵守：描述中绝对禁止出现任何人物、角色、人类、人形生物、手、手指、脸、面部、头部、身体、躯干、肢体、姿态、站姿、坐姿、表情、眼神、穿着、衣服、服装、发型、头发、发饰、肌肤、皮肤。道具必须是纯物体/器物/装备描述，场景必须是纯环境/空间/建筑描述。任何与人相关的词汇都是错误。`
      : "";

    const systemPrompt = `你是一位顶级影视/游戏视觉概念设计师，同时是AI生图提示词专家。你拥有极高的审美水准和丰富的影视美术经验。

你的任务：根据用户的修改指令，对资产描述进行创意重写。

工作原则：
1. 【严格执行用户指令】用户的修改指令是最高优先级，必须严格照做，不打折扣
2. 【画风统一】你的输出必须严格符合当前指定画风，所有视觉词汇、质感描述、光影方式都要符合该画风的审美体系
3. 【审美自由】你拥有充分的创作自由，不用刻意忠于原文。你可以重新组织语言、调整结构、增减细节，只要最终效果更有美感、更适合AI生图
4. 【保留核心锚点】只保留资产最核心的身份标识：角色名、标志性装备/道具、基础配色方案。其余一切都可以根据审美重新设计
5. 【风格纯净】输出中严禁出现任何与当前画风冲突的词汇（如国漫画风里严禁出现"线稿、赛璐珞、大眼睛、日系"等词）
6. 【类型隔离 —— 最高优先级】若资产类型为「道具」或「场景」，描述中绝对禁止出现人物、角色、人类、人形生物、手、手指、脸、面部、头部、身体、躯干、肢体、姿态、站姿、坐姿、表情、眼神、穿着、衣服、服装、发型、头发、发饰、肌肤、皮肤等与人相关的任何元素。道具必须是纯物体/器物/装备描述，场景必须是纯环境/空间/建筑描述。违反此条即为错误。${typeIsolationPrompt}
7. 只输出纯文本描述，不要解释、不要markdown、不要JSON
8. 一段完整连续文本，约200-400字，不分段不列点`;

    const userPrompt = `【资产类型】${assetType}${isPropOrScene ? " —— 此为纯物体/环境描述，严禁出现人物、身体、姿态、表情、穿着、发型等任何与人相关的元素" : ""}
【资产名称】${assetName}

【当前画风（你必须严格遵循）】
${stylePrefix}

【生图英文画风前缀（供你参考该画风的视觉体系）】
${imagePrefix}

【当前资产内容（仅作参考，你可以自由改写）】
${contentOnly}

【用户修改指令（必须严格执行）】
${instruction.trim()}

请根据用户指令进行创意重写，输出一段符合当前画风、有审美水准的AI生图描述。以画风前缀开头。${isPropOrScene ? "\n注意：本资产是「" + assetType + "」，描述必须是纯物体/环境描写，绝对禁止出现任何人物、角色、人类形象、身体部位、姿态、表情、穿着、发型。" : ""}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const rawText = await callChat({
      provider: textProvider,
      baseUrl,
      apiKey: currentApiKey,
      model: modelId,
      messages,
      temperature: 0.85,
      timeoutMs: 60000,
    });

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: "模型未返回有效内容" },
        { status: 502 }
      );
    }

    let refined = rawText.trim();
    if (refined.startsWith("```")) {
      refined = refined
        .replace(/^```\w*\s*/i, "")
        .replace(/\s*```$/, "");
    }

    // 兜底：确保前缀正确
    const bodyOnly = stripAllStyleLabels(refined);
    refined = (stylePrefix + " " + bodyOnly).trim();

    // 道具/场景最终兜底：强制清理人物相关词汇
    refined = sanitizePropScene(refined, assetType);

    return NextResponse.json({
      success: true,
      description: refined,
      assetName,
    });
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
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
