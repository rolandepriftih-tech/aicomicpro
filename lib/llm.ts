import { GoogleGenAI } from "@google/genai";
import { configureNetworkProxy } from "./network-proxy";
import { resolveBaseUrl } from "./api-utils";

export type LLMProvider = "gemini" | "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

export interface CallChatOptions {
  provider: LLMProvider;
  baseUrl?: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
  /** 最大输出 token 数，未设置则使用模型默认值 */
  maxTokens?: number;
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`LLM request timeout (${timeoutMs}ms)`)),
      timeoutMs
    );
  });
}

export async function callChat(options: CallChatOptions): Promise<string> {
  const {
    provider,
    baseUrl,
    apiKey,
    model,
    messages,
    temperature = 0.7,
    timeoutMs = 120000,
    maxTokens,
  } = options;

  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
  console.log(`[LLM Debug] provider=${provider}, model=${model}, baseUrl=${resolvedBaseUrl || "default"}, timeout=${timeoutMs}ms`);

  configureNetworkProxy();

  if (provider === "gemini") {
    const ai = new GoogleGenAI({
      apiKey,
      ...(resolvedBaseUrl ? { baseUrl: resolvedBaseUrl } : {}),
    });

    let systemInstruction: string | undefined;
    const contents: Array<{
      role: string;
      parts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        if (typeof msg.content === "string") {
          systemInstruction = msg.content;
        }
        continue;
      }

      const parts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }> = [];

      if (typeof msg.content === "string") {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "text") {
            parts.push({ text: part.text });
          } else if (part.type === "image_url") {
            const url = part.image_url.url;
            if (url.startsWith("data:")) {
              const match = url.match(/^data:([^;,]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1].trim(),
                    data: match[2].replace(/\s/g, ""),
                  },
                });
              }
            } else {
              parts.push({ text: `[Image reference: ${url}]` });
            }
          }
        }
      }

      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts,
      });
    }

    const geminiConfig: Record<string, unknown> = {
      systemInstruction,
      temperature,
    };
    if (maxTokens && maxTokens > 0) {
      geminiConfig.maxOutputTokens = maxTokens;
    }

    const geminiPromise = ai.models.generateContent({
      model,
      contents,
      config: geminiConfig,
    });

    const result = await Promise.race([
      geminiPromise,
      createTimeoutPromise(timeoutMs),
    ]);
    return String(result.text ?? "").trim();
  }

  // OpenAI compatible path — 直接用原生 fetch，绕过 OpenAI SDK 连接池问题
  const apiBase = resolvedBaseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";
  const url = `${apiBase}/chat/completions`;

  // 转换消息格式
  const formattedMessages = messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
    }
    // 多模态内容
    return {
      role: msg.role,
      content: msg.content.map((part) => {
        if (part.type === "text") return { type: "text", text: part.text };
        return { type: "image_url", image_url: { url: part.image_url.url } };
      }),
    };
  });

  console.log("[LLM Debug] Sending fetch request to:", url);
  const startTime = Date.now();

  try {
    const fetchPromise = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature,
        ...(maxTokens && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return res.json();
    });

    const data = await Promise.race([
      fetchPromise,
      createTimeoutPromise(timeoutMs),
    ]);

    console.log(`[LLM Debug] Response received in ${Date.now() - startTime}ms`);
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error(`[LLM Debug] Request failed after ${Date.now() - startTime}ms:`, err);
    throw err;
  }
}
