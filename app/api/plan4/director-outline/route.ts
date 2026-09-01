import { NextRequest, NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { getErrorMessage } from "@/lib/errors";
import { DEFAULT_STYLE } from "@/lib/style-config";
import type { Plan4DirectorOutlineResponse } from "@/types/plan4";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DirectorOutlineBody = {
  script?: string;
  apiKey?: string;
  aspectRatio?: string;
  style?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  baseUrl?: string;
  /** 与分镜生成类似，可选传入已定妆资产聚合对象 */
  lockedAssets?: unknown;
};


export async function POST(request: NextRequest) {
  let body: DirectorOutlineBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求体必须是 JSON。" },
      { status: 400 }
    );
  }

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (script.length < 20) {
    return NextResponse.json(
      { error: "剧本过短，请至少提供约 20 字以上便于导演占位分段。" },
      { status: 400 }
    );
  }

  if (!body.apiKey?.trim()) {
    return NextResponse.json(
      { error: "缺少 apiKey。" },
      { status: 401 }
    );
  }

  const textProvider = body.textProvider ?? "gemini";
  const textModel = body.textModel?.trim() || "gemini-2.5-pro";
  const aspectRatio = body.aspectRatio ?? "16:9";
  const style = body.style ?? DEFAULT_STYLE;
  const lockedAssets = body.lockedAssets;

  const assetsPayload =
    lockedAssets != null && typeof lockedAssets === "object"
      ? JSON.stringify(lockedAssets, null, 2)
      : "[]";

  const systemPrompt = `你是一位顶级的动画/影视分镜导演，擅长将剧本拆解为工业级分镜大纲，并为每一格指定最适合的 AI 生图技术路线。`;

  const userPrompt = `【任务】
请阅读以下剧本，并输出一份导演大纲（Director Outline）。大纲包含两部分：
1. meta：全片连贯性说明、画风前缀建议。
2. panels：逐格分镜，每格必须包含 storyBeat、chineseDirectorNotes、englishImagePrompt、generationStrategy、strategyRationale 等字段。

【已定妆资产 lockedAssets】
${assetsPayload}

【剧本原文】
${script}

【技术约束】
- 画幅比例：${aspectRatio}
- 画面风格：${style}

【每格必须包含的字段】
- panelIndex: 序号（从 1 开始）
- storyBeat: 一句话剧情节拍
- chineseDirectorNotes: 中文画面说明
- englishImagePrompt: 给生图模型的英文提示词
- generationStrategy: 生图策略，必须是以下之一：single_t2i（单图文生图）、first_last_frame（首尾帧过渡）、multi_reference（多参考图一致性约束）、nine_grid（九宫格叙事拼图）
- strategyRationale: 为什么选择该策略的简短理由
- primaryReferenceAssets?: 本格依赖的主要资产名数组（可选）
- continuityWithPanelIndex?: 与上一格或指定格的连贯关系（可选，null 表示无）
- nineGridCellHints?: 若使用 nine_grid，提供 3x3 每格一句占位说明（可选）

【策略选择指南】
- 首镜以氛围与空间为主 → single_t2i
- 强连续动作（角色大幅度位移或转身，需要与上一镜头姿态衔接）→ first_last_frame
- 多角色同框，需锁脸锁服；或关键道具与场景同时清晰 → multi_reference
- 快节奏信息轰炸，适合网格叙事 → nine_grid

【输出要求】
只输出一个合法 JSON 对象，禁止 Markdown 围栏，禁止额外说明文字。结构必须满足 Plan4DirectorOutlineResponse 类型：

{
  "meta": {
    "globalContinuityNotes": "全片连贯性说明（光影、时间线、风格锁等）",
    "stylePrefixHint": "画风/技术前缀建议"
  },
  "panels": [
    {
      "panelIndex": 1,
      "storyBeat": "建立场景",
      "chineseDirectorNotes": "...",
      "englishImagePrompt": "...",
      "generationStrategy": "single_t2i",
      "strategyRationale": "...",
      "primaryReferenceAssets": [],
      "continuityWithPanelIndex": null
    }
  ]
}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const rawText = await callChat({
      provider: textProvider,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey.trim(),
      model: textModel,
      messages,
      temperature: 0.7,
      timeoutMs: 60000,
      maxTokens: 32000,
    });

    if (!rawText) {
      return NextResponse.json(
        { error: "模型未返回有效内容" },
        { status: 502 }
      );
    }

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let data: unknown;
    try {
      data = JSON.parse(cleaned) as unknown;
    } catch {
      return NextResponse.json(
        {
          error: "模型返回内容无法解析为 JSON。",
          raw: rawText.slice(0, 600),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data as Plan4DirectorOutlineResponse);
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
