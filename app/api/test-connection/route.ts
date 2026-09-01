import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { resolveImagenModelId } from "@/lib/model-capabilities";
import { callChat } from "@/lib/llm";
import { generateImage } from "@/lib/image-gen";
import { classifyImageError } from "@/lib/image-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TestConnectionBody = {
  /** 兼容旧版统一 apiKey */
  apiKey?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textBaseUrl?: string;
  textApiKey?: string;
  imageProvider?: "gemini" | "openai";
  imageEngine?: "nano-banana-2" | "nano-banana-pro";
  imageModel?: string;
  imageBaseUrl?: string;
  imageApiKey?: string;
  /** 兼容旧版统一 baseUrl */
  baseUrl?: string;
};


export async function GET() {
  return NextResponse.json(
    { error: "请使用 POST 请求，并携带 apiKey（可选）、textModel、imageEngine。" },
    { status: 405 }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TestConnectionBody;
    const {
      apiKey,
      textProvider = "gemini",
      textModel = "gemini-2.5-pro",
      textBaseUrl,
      textApiKey,
      imageProvider = "gemini",
      imageEngine = "nano-banana-2",
      imageModel,
      imageBaseUrl,
      imageApiKey,
      baseUrl,
    } = body;

    const currentTextApiKey =
      textApiKey?.trim() || apiKey?.trim() || process.env.GEMINI_API_KEY;
    const currentImageApiKey =
      imageApiKey?.trim() || apiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!currentTextApiKey && !currentImageApiKey) {
      return NextResponse.json(
        { success: false, error: "未提供 API Key" },
        { status: 400 }
      );
    }

    const targetImageModel =
      imageProvider === "gemini"
        ? resolveImagenModelId(imageEngine)
        : imageModel?.trim() || "dall-e-3";

    let textSuccess = false;
    let imageSuccess = false;
    let errorMessage = "";

    // 1. 文本模型连通性测试
    if (currentTextApiKey) {
      try {
        const reply = await callChat({
          provider: textProvider,
          baseUrl: textBaseUrl || baseUrl,
          apiKey: currentTextApiKey,
          model: textModel.trim(),
          messages: [{ role: "user", content: 'API Test: Reply "OK"' }],
          temperature: 0.5,
          timeoutMs: 20000,
        });
        if (reply.trim()) {
          textSuccess = true;
        }
      } catch (e) {
        errorMessage += `[文本 ${textModel} 报错]: ${getErrorMessage(e)}\n`;
      }
    } else {
      errorMessage += "[文本] 未提供 API Key\n";
    }

    // 2. 图像模型连通性测试
    if (currentImageApiKey) {
      try {
        await generateImage({
          provider: imageProvider,
          baseUrl: imageBaseUrl || baseUrl,
          apiKey: currentImageApiKey,
          model: targetImageModel,
          prompt: "A simple minimalist blue dot",
          aspectRatio: "1:1",
        });
        imageSuccess = true;
      } catch (e) {
        const classified = classifyImageError(getErrorMessage(e));
        errorMessage += `[视觉 ${targetImageModel} 报错]: ${classified.message}\n`;
      }
    } else {
      errorMessage += "[视觉] 未提供 API Key\n";
    }

    return NextResponse.json({
      success: textSuccess && imageSuccess,
      textSuccess,
      imageSuccess,
      message: errorMessage.trim() || "✅ 文本与视觉引擎双路畅通！",
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const status =
      message.includes("401") || message.toLowerCase().includes("unauthorized")
        ? 401
        : message.includes("404") || message.toLowerCase().includes("not found")
          ? 404
          : message.toLowerCase().includes("403") || message.includes("permission")
            ? 403
            : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
