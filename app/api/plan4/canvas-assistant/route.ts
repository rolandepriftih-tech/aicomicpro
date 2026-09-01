import { NextRequest, NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { getErrorMessage } from "@/lib/errors";
import type { Plan4CanvasState } from "@/types/plan4";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CanvasAssistantBody = {
  instruction?: string;
  canvas?: Plan4CanvasState | null;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textBaseUrl?: string;
  textApiKey?: string;
};


function summarizeCanvas(canvas: Plan4CanvasState | null | undefined) {
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes : [];
  const edges = Array.isArray(canvas?.edges) ? canvas.edges : [];

  return {
    nodes: nodes.slice(0, 80).map((node) => {
      const data = node.data as unknown as Record<string, unknown>;
      return {
        id: node.id,
        type: node.type,
        name: data.name,
        panelId: data.panelId,
        storyBeat: data.storyBeat,
        assetType: data.assetType,
        description: data.description,
        chineseDirectorNotes: data.chineseDirectorNotes,
        englishImagePrompt: data.englishImagePrompt,
        styleValue: data.styleValue,
        hasImage: Boolean(data.imageUrl || data.referenceImage),
        generateStatus: data.generateStatus,
        consistencyLock: data.consistencyLock,
      };
    }),
    edges: edges.slice(0, 160).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
    })),
    totals: {
      nodes: nodes.length,
      edges: edges.length,
      assets: nodes.filter((n) => n.type === "asset").length,
      panels: nodes.filter((n) => n.type === "panel").length,
      styles: nodes.filter((n) => n.type === "style").length,
    },
  };
}

export async function POST(request: NextRequest) {
  let body: CanvasAssistantBody;
  try {
    body = (await request.json()) as CanvasAssistantBody;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON。" }, { status: 400 });
  }

  const instruction = body.instruction?.trim();
  if (!instruction) {
    return NextResponse.json({ error: "请输入要分析的问题。" }, { status: 400 });
  }

  const apiKey = body.textApiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "缺少文本模型 API Key。" }, { status: 401 });
  }

  const textProvider = body.textProvider ?? "gemini";
  const textModel = body.textModel?.trim() || "gemini-2.5-pro";
  const canvasSummary = summarizeCanvas(body.canvas);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "你是 AI Comic Pro 的画布创作助手。你只能分析和建议，不要声称已经修改画布。回答要具体、可执行、短而清楚。优先指出分镜节奏、角色一致性、缺失参考图、连线依赖、提示词质量和下一步操作。",
    },
    {
      role: "user",
      content: `【用户需求】
${instruction}

【当前画布摘要 JSON】
${JSON.stringify(canvasSummary, null, 2)}

【输出要求】
用中文输出，结构如下：
1. 结论：一句话说明当前最重要的问题或机会。
2. 建议：3-6 条，每条具体到节点/分镜/资产。
3. 下一步：给出最推荐的一步操作。
不要输出 Markdown 表格。不要自动改写完整长提示词，除非用户明确要求。`,
    },
  ];

  try {
    const result = await callChat({
      provider: textProvider,
      baseUrl: body.textBaseUrl,
      apiKey,
      model: textModel,
      messages,
      temperature: 0.4,
      timeoutMs: 60000,
      maxTokens: 1800,
    });

    return NextResponse.json({ result });
  } catch (err) {
    const raw = getErrorMessage(err);
    const status =
      raw.includes("401") || raw.toLowerCase().includes("unauthorized")
        ? 401
        : /timeout|timed out|deadline|aborted/i.test(raw)
          ? 504
          : 500;
    return NextResponse.json({ error: raw }, { status });
  }
}
