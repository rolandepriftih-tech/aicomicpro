import { NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/llm";
import { PROMPT_SKILLS, detectSkills, composeSystemPrompt } from "@/lib/prompt-skills";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExpandPromptBody = {
  /** 用户的简单描述（白话） */
  prompt: string;
  /** 技能 id，默认 "base"（综合润色） */
  skill?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textApiKey?: string;
  baseUrl?: string;
  /** 可选参数：目标时长（秒） */
  duration?: number;
  /** 可选参数：画幅 */
  aspectRatio?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExpandPromptBody;
    const rawPrompt = body.prompt?.trim();

    if (!rawPrompt) {
      return NextResponse.json(
        { success: false, error: "缺少 prompt（用户的简单描述）。" },
        { status: 400 }
      );
    }

    // 意图检测：用户显式指定 skill 则用指定值；否则多维检测（可命中多个专项模板）
    const matchedSkills =
      body.skill && body.skill !== "base"
        ? [body.skill]
        : detectSkills(rawPrompt);
    const systemPrompt = composeSystemPrompt(matchedSkills);
    const usedSkill = matchedSkills.length > 0 ? matchedSkills.join("+") : "base";

    // API Key：优先请求体，兜底环境变量
    const apiKey =
      body.textApiKey?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "缺少文本引擎 API Key。请在左侧配置文本引擎，或在 .env.local 设置 GEMINI_API_KEY / OPENAI_API_KEY。",
        },
        { status: 400 }
      );
    }

    // 组装 user 消息：白话 + 可选约束
    const constraints: string[] = [];
    if (body.duration) constraints.push(`目标时长：${body.duration} 秒`);
    if (body.aspectRatio) constraints.push(`画幅：${body.aspectRatio}`);
    const constraintText =
      constraints.length > 0 ? `\n\n【用户约束】\n${constraints.join("\n")}` : "";

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请把下面这句简单的创作描述扩写成专业、可直接用于生成的提示词。${constraintText}\n\n【用户描述】\n${rawPrompt}`,
      },
    ];

    const rawText = await callChat({
      provider: body.textProvider ?? "gemini",
      baseUrl: body.baseUrl,
      apiKey,
      model: body.textModel ?? (body.textProvider === "openai" ? "gpt-4o" : "gemini-2.5-pro"),
      messages,
      temperature: 0.7,
      maxTokens: 2048,
    });

    if (!rawText.trim()) {
      return NextResponse.json(
        { success: false, error: "扩写结果为空，请重试。" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt: rawText.trim(),
      skill: usedSkill,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "扩写失败";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
