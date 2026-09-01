/**
 * TTS (Text-to-Speech) 文本转语音模块
 * 支持小米 MiMo TTS 语音模型
 */

export interface TTSOptions {
  provider: "mimo" | "openai";
  baseUrl?: string;
  apiKey: string;
  model?: string;
  text: string;
  voice?: string;
  /** 风格控制（仅 MiMo）：开心、东北话、悄悄话等 */
  style?: string;
  /** 输出格式：wav, mp3 */
  format?: "wav" | "mp3";
}

export interface TTSResult {
  audio: ArrayBuffer;
  contentType: string;
}

/**
 * 小米 MiMo TTS 可用音色列表
 */
export const MIMO_VOICES = [
  { id: "mimo_default", name: "默认音色", description: "通用音色" },
  { id: "default_zh", name: "中文女声", description: "适合中文内容" },
  { id: "default_en", name: "英文女声", description: "适合英文内容" },
] as const;

/**
 * 小米 MiMo TTS 可用风格列表
 */
export const MIMO_STYLES = [
  { id: "", name: "无风格", description: "默认语音风格" },
  { id: "开心", name: "开心", description: "表达开心情绪" },
  { id: "东北话", name: "东北话", description: "东北方言风格" },
  { id: "悄悄话", name: "悄悄话", description: "低声细语风格" },
  { id: "温柔", name: "温柔", description: "温柔体贴语气" },
  { id: "严肃", name: "严肃", description: "正式严肃语气" },
  { id: "激动", name: "激动", description: "情绪激动语气" },
  { id: "悲伤", name: "悲伤", description: "悲伤难过语气" },
] as const;

/**
 * 调用小米 MiMo TTS API 生成语音
 * API 文档：https://token-plan-cn.xiaomimimo.com/v1
 */
async function callMimoTTS(options: TTSOptions): Promise<TTSResult> {
  const {
    baseUrl = "https://token-plan-cn.xiaomimimo.com/v1",
    apiKey,
    model = "mimo-v2-tts",
    text,
    voice = "mimo_default",
    style,
    format = "wav",
  } = options;

  // 如果有风格，添加风格前缀
  let finalText = text;
  if (style) {
    finalText = `<style>${style}</style>${text}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: "请朗读以下内容",
        },
        {
          role: "assistant",
          content: finalText,
        },
      ],
      voice,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo TTS failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // 解析响应：choices[0].message.audio.data (base64)
  const audioBase64 = data.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) {
    throw new Error("No audio data in response");
  }

  // 解码 base64 音频数据
  const audioBinary = atob(audioBase64);
  const audioArray = new Uint8Array(audioBinary.length);
  for (let i = 0; i < audioBinary.length; i++) {
    audioArray[i] = audioBinary.charCodeAt(i);
  }

  return {
    audio: audioArray.buffer,
    contentType: `audio/${format}`,
  };
}

/**
 * 调用 OpenAI 兼容的 TTS API
 */
async function callOpenAITTS(options: TTSOptions): Promise<TTSResult> {
  const {
    baseUrl = "https://api.openai.com/v1",
    apiKey,
    model = "tts-1",
    text,
    voice = "alloy",
    format = "mp3",
  } = options;

  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: format,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS failed: ${response.status} - ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();

  return {
    audio: audioBuffer,
    contentType: response.headers.get("content-type") || `audio/${format}`,
  };
}

/**
 * 生成语音的统一入口
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const { provider } = options;

  switch (provider) {
    case "mimo":
      return callMimoTTS(options);
    case "openai":
      return callOpenAITTS(options);
    default:
      throw new Error(`Unsupported TTS provider: ${provider}`);
  }
}

/**
 * 将 ArrayBuffer 转换为 base64 数据 URL
 */
export function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${contentType};base64,${base64}`;
}
