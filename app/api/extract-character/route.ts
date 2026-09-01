import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const o = err as { message?: string };
  return typeof o?.message === "string" ? o.message : String(err);
}

interface ExtractCharacterBody {
  imageBase64: string;
  provider?: "gemini" | "openai";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

const EXTRACTION_PROMPT = `Analyze the character in this image and extract their consistent visual features. Describe in Chinese:
- Hair style, color, and length
- Eye color and shape
- Facial features (nose, mouth, face shape)
- Clothing style, colors, and details
- Body type and height/build
- Any distinctive accessories or markings
- Overall art style and color palette

Return ONLY a JSON object in this exact format:
{"features": "金色长发，蓝眼睛，白色连衣裙..."}

The features string should be a concise but comprehensive description that can be used to maintain character consistency across multiple generated images.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractCharacterBody;
    const imageBase64 = body.imageBase64?.trim();
    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "缺少 imageBase64 参数" },
        { status: 400 }
      );
    }

    const provider = body.provider ?? "gemini";
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "缺少 API Key" },
        { status: 401 }
      );
    }

    let features = "";

    if (provider === "gemini") {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: body.model?.trim() || "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType: imageBase64.includes("image/png") ? "image/png" : "image/jpeg",
                  data: imageBase64.split(",")[1] || imageBase64,
                },
              },
            ],
          },
        ],
      });
      const text = response?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        features = parsed.features || "";
      } else {
        features = text.slice(0, 500);
      }
    } else {
      const client = new OpenAI({
        apiKey,
        ...(body.baseUrl ? { baseURL: body.baseUrl } : {}),
      });
      const chatRes = await client.chat.completions.create({
        model: body.model?.trim() || "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              {
                type: "image_url",
                image_url: { url: imageBase64, detail: "high" },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });
      const text = chatRes.choices?.[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        features = parsed.features || "";
      } else {
        features = text.slice(0, 500);
      }
    }

    return NextResponse.json({
      success: true,
      features,
    });
  } catch (err) {
    const raw = getErrorMessage(err);
    return NextResponse.json(
      { success: false, error: raw },
      { status: 502 }
    );
  }
}
