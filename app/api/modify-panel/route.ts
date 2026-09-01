import { NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { getErrorMessage } from "@/lib/errors";
import type { StoryboardPanel } from "@/types/analyze";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ModifyPanelBody = {
  panelData: StoryboardPanel | unknown;
  instruction: string;
  apiKey?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  baseUrl?: string;
};


export async function POST(request: Request) {
  let body: ModifyPanelBody;
  try {
    body = (await request.json()) as ModifyPanelBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体必须是有效的 JSON" },
      { status: 400 }
    );
  }

  const { panelData, instruction, apiKey, textModel, baseUrl } = body;
  const textProvider = body.textProvider ?? "gemini";
  const modelId = textModel?.trim() || "gemini-2.5-pro";

  if (!panelData || typeof panelData !== "object") {
    return NextResponse.json(
      { success: false, error: "缺少或无效的分镜数据（panelData 必须是对象）。" },
      { status: 400 }
    );
  }
  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json(
      { success: false, error: "缺少修改指令（instruction）。" },
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

  try {
    const panelJson = JSON.stringify(panelData, null, 2);

    const systemPrompt = `你是一位顶级的「分镜修改副导演」。你的任务是在**不改变 JSON 结构与字段名**的前提下，只修改必要的字段内容，使其满足指令要求。`;

    const userPrompt = `下面是当前分镜卡的完整 JSON 结构 panelData，以及用户给出的自然语言修改指令 instruction。

【当前分镜 JSON（panelData）】
${panelJson}

【用户修改指令（instruction）】
${instruction}

【字段与指令映射强约束】
- 若用户说「加台词」「改台词」「增加对白」等：优先修改 plotContent 字段，使其符合新台词描述；必要时可在 continuityCheck 中追加简短说明。
- 若用户说「改XX为YY」「把大炮改成激光枪」等涉及道具 / 视觉主体的改动：
  - 必须同步修改 plotContent、imagePrompt、videoPrompt 中的相关描述；
  - 保证三者在主体 / 道具名称与视觉特征上完全一致。
- 若用户说「改运镜」「换机位」：更新 cameraMovement 字段，必要时在 imagePrompt / videoPrompt 中补充相应英文术语（如 Dolly Zoom, Whip Pan）。
- 若用户说「改转场」「改剪辑」：更新 transition 字段（如 Cut, Match Cut, Dissolve）。
- 若只明确提到某一项（如只说转场），则尽量只改对应字段，其它字段尽量保持不变。

【提示词与安全合规】
- 修改 imagePrompt / videoPrompt 时，必须保留原有的 Token 排序逻辑和安全合规原则（不要添加违规内容，如极度血腥、色情等）。
- 若原本结尾已有 "--ar 16:9" 等画幅参数，请在修改后继续保留。

【输出要求】
- 你必须只输出一个 JSON 对象，其结构与 panelData 完全一致；
- 不允许增加或删除顶层字段（如 panelId, timeRange, assetsUsed, continuityCheck, plotContent, cameraMovement, transition, imagePrompt, videoPrompt, negativePrompt, imageReferences 等）；
- 不要输出任何说明文字、Markdown 标记或代码块，只输出纯 JSON。
`;

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
      temperature: 0.7,
      timeoutMs: 45000,
      maxTokens: 16000,
    });

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: "模型未返回有效内容" },
        { status: 502 }
      );
    }

    let cleaned = rawText;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```$/, "");
    }
    cleaned = cleaned.trim();

    let updatedPanel: StoryboardPanel;
    try {
      updatedPanel = JSON.parse(cleaned) as StoryboardPanel;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "模型返回内容无法解析为 JSON。",
          rawText: rawText.slice(0, 600),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedPanel,
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
