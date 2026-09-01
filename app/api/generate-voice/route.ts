import { NextRequest, NextResponse } from "next/server";
import { generateSpeech, type TTSOptions } from "@/lib/tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      provider = "mimo",
      baseUrl,
      apiKey,
      model,
      text,
      voice = "mimo_default",
      style,
      format = "wav",
    } = body as Partial<TTSOptions> & { text: string };

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    console.log(`[TTS] Generating voice: provider=${provider}, voice=${voice}, style=${style || "none"}, text=${text.substring(0, 50)}...`);

    const result = await generateSpeech({
      provider,
      baseUrl,
      apiKey,
      model,
      text,
      voice,
      style,
      format,
    });

    // 返回音频文件
    return new NextResponse(result.audio, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.audio.byteLength),
      },
    });
  } catch (error: any) {
    console.error("[TTS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Voice generation failed" },
      { status: 500 }
    );
  }
}
