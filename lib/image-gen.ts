import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";
import { addLog, updateLog } from "./image-logger";
import { classifyImageError, ImageGenerationError } from "./image-errors";
import { configureNetworkProxy } from "./network-proxy";
import { buildImagePrompt } from "@/lib/image-prompts/build-image-prompt";
import { normalizeImageTimeoutMs } from "@/lib/image-runtime-options";
import { parseReferenceDataUrl } from "./parseReferenceDataUrl";
import { resolveBaseUrl } from "./api-utils";
import type {
  ImageAssetType,
  ImageReferenceMeta,
  ImageTaskType,
} from "@/lib/image-generation-types";

export type ImageProvider = "gemini" | "openai";

export function buildOpenAIClientOptions(options: {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
}) {
  const resolvedBaseUrl = resolveBaseUrl(options.baseUrl);
  return {
    apiKey: options.apiKey,
    ...(resolvedBaseUrl ? { baseURL: resolvedBaseUrl } : {}),
    timeout: options.timeoutMs,
    maxRetries: 0,
  };
}

export interface GenerateImageOptions {
  provider: ImageProvider;
  baseUrl?: string;
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: string;
  stylePrefix?: string;
  taskType?: ImageTaskType;
  assetType?: ImageAssetType;
  assetName?: string;
  /** 资产参考图 base64 data URL，传入后优先走支持多模态的生成路径 */
  referenceImage?: string;
  /** 多资产参考图数组（用于一个分镜同时引用多个资产） */
  referenceImages?: string[];
  referenceMetas?: ImageReferenceMeta[];
  timeoutMs?: number;
}

function resolveOpenAIImageSize(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "16:9":
      return "1792x1024";
    case "9:16":
      return "1024x1792";
    case "3:4":
      return "1024x1536";
    case "4:3":
      return "1536x1024";
    case "1:1":
    default:
      return "1024x1024";
  }
}

function resolveGeminiAspectRatio(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "16:9":
      return "16:9";
    case "9:16":
      return "9:16";
    case "3:4":
      return "3:4";
    case "4:3":
      return "4:3";
    case "1:1":
    default:
      return "1:1";
  }
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<{ imageUrl: string }> {
  const {
    provider,
    baseUrl,
    apiKey,
    model,
    prompt,
    aspectRatio,
    stylePrefix,
    taskType = "asset-custom",
    assetType,
    assetName,
    referenceImage,
    referenceImages: referenceImagesArr,
    referenceMetas,
    timeoutMs,
  } = options;
  const requestTimeoutMs = normalizeImageTimeoutMs(timeoutMs);

  // 合并单张和多张参考图
  const allReferenceImages: string[] = [];
  if (referenceImage) allReferenceImages.push(referenceImage);
  if (referenceImagesArr?.length) {
    for (const img of referenceImagesArr) {
      if (img && !allReferenceImages.includes(img)) allReferenceImages.push(img);
    }
  }

  const start = Date.now();
  const logId = `${start}-${Math.random().toString(36).slice(2, 8)}`;
  const finalPrompt = buildImagePrompt(prompt, {
    taskType,
    assetType,
    assetName,
    stylePrefix,
    references: referenceMetas,
  });

  addLog({
    id: logId,
    timestamp: start,
    provider,
    model,
    baseUrl: baseUrl || "",
    prompt: finalPrompt,
    status: "pending",
    durationMs: 0,
  });

  configureNetworkProxy();

  try {
    let imageUrl: string;

    if (provider === "gemini") {
      const resolvedBaseUrl = resolveBaseUrl(baseUrl);
      const ai = new GoogleGenAI({
        apiKey,
        ...(resolvedBaseUrl ? { baseUrl: resolvedBaseUrl } : {}),
      });

      if (allReferenceImages.length > 0) {
        // 带参考图：generateImages（Imagen）的 config 没有 referenceImages 字段，
        // 传入自造字段会被静默忽略（用户以为参考图生效实际没用上）。Gemini 官方
        // 参考图通道是原生图像模型 generateContent + inlineData。
        imageUrl = await geminiReferenceImageGen({
          client: ai,
          prompt: finalPrompt,
          referenceImages: allReferenceImages,
          aspectRatio,
          timeoutMs: requestTimeoutMs,
        });
      } else {
        // 纯文生图：Imagen 4。abortSignal 挂上请求级超时，否则任务卡死会拖满
        // 上游网关超时（可能数分钟）才失败
        const response = await withAbortTimeout(requestTimeoutMs, (signal) =>
          ai.models.generateImages({
            model,
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: resolveGeminiAspectRatio(aspectRatio),
              abortSignal: signal,
            },
          })
        );

        const images = response?.generatedImages;
        const base64Image = images?.[0]?.image?.imageBytes;
        if (!base64Image) {
          throw new Error("Gemini Imagen did not return image data");
        }
        imageUrl = `data:image/jpeg;base64,${base64Image}`;
      }
    } else {
      // OpenAI / DALL-E compatible path
      const client = new OpenAI(buildOpenAIClientOptions({
        apiKey,
        baseUrl,
        timeoutMs: requestTimeoutMs,
      }));

      if (allReferenceImages.length > 0) {
        imageUrl = prefersOpenAIImagesApi(model)
          ? await tryOpenAIImageEditGen(client, model, finalPrompt, allReferenceImages, aspectRatio, requestTimeoutMs, logId)
          : await tryOpenAIChatImageGen(client, model, finalPrompt, allReferenceImages, requestTimeoutMs, logId);
      } else {
        imageUrl = await tryOpenAIImageGen(client, model, finalPrompt, aspectRatio, requestTimeoutMs, logId);
      }
    }

    updateLog(logId, {
      status: "success",
      durationMs: Date.now() - start,
      result: `${imageUrl.slice(0, 60)}...`,
    });

    return { imageUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateLog(logId, {
      status: "error",
      durationMs: Date.now() - start,
      error: msg,
    });
    throw err;
  }
}

/**
 * OpenAI chat.completions 多模态生图路径：当用户提供了参考图时，
 * 将参考图以 image_url 形式传入 messages，让支持图像输出的模型（如 gpt-image-2）参考生成。
 */
async function tryOpenAIChatImageGen(
  client: OpenAI,
  model: string,
  finalPrompt: string,
  referenceImages: string[],
  timeoutMs: number,
  logId: string
): Promise<string> {
  updateLog(logId, {
    result: "calling chat.completions with reference images (SDK retries disabled)",
  });
  type ContentPart = OpenAI.ChatCompletionContentPart;
  const contentParts: ContentPart[] = [{ type: "text", text: finalPrompt }];
  for (const img of referenceImages) {
    contentParts.push({
      type: "image_url",
      image_url: { url: img, detail: "high" },
    });
  }

  const content = await createChatImageContent(
    client,
    {
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an image generation assistant. Generate a high-quality image according to the user's description and reference images. Return the image as a base64 data URL if possible, or describe it vividly if you cannot output images directly.",
        },
        {
          role: "user",
          content: contentParts,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    },
    timeoutMs
  );
  updateLog(logId, {
    result: `chat.completions returned ${content.length} chars; parsing image URL/data`,
  });

  // 1. 尝试从 content 中提取 base64 data URL（支持裸文本、markdown、HTML img）
  const b64Patterns = [
    /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/,
    /<img[^>]+src=["']data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)["']/i,
  ];
  for (const pattern of b64Patterns) {
    const b64Match = content.match(pattern);
    if (b64Match && b64Match[1].length > 100) {
      const mimeType = content.match(/data:image\/([^;]+)/)?.[1] || "png";
      return `data:image/${mimeType};base64,${b64Match[1]}`;
    }
  }

  // 2. 尝试提取 markdown 图片链接并下载
  const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) {
    return fetchImageUrlAsDataUrl(mdMatch[1], 15_000).catch(() => mdMatch[1]);
  }

  // 3. 尝试提取 HTML img src 外链
  const imgUrlMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (imgUrlMatch) {
    return fetchImageUrlAsDataUrl(imgUrlMatch[1], 15_000).catch(() => imgUrlMatch[1]);
  }

  // 4. 尝试提取裸 URL（图片直链）
  const bareUrlMatch = content.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif))/i);
  if (bareUrlMatch) {
    return fetchImageUrlAsDataUrl(bareUrlMatch[1], 15_000).catch(() => bareUrlMatch[1]);
  }

  console.error("[image-gen] chat.completions returned content without parseable image. Content preview:", content.slice(0, 600));
  throw new Error(
    `chat.completions 未返回可解析的图片数据。模型可能不支持图像输出，或返回格式未识别。`
  );
}

async function withAbortTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Image generation timeout (${timeoutMs}ms)`));
  }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Image generation timeout (${timeoutMs}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Gemini 原生图像模型（参考图通道专用；纯文生图仍走 Imagen） */
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

/**
 * Gemini 参考图生图：走原生图像模型的 generateContent 多模态输入。
 * 参考图以 inlineData 内联，prompt 作为文本部分追加在图片之后。
 */
async function geminiReferenceImageGen(options: {
  client: GoogleGenAI;
  prompt: string;
  referenceImages: string[];
  aspectRatio?: string;
  timeoutMs: number;
}): Promise<string> {
  const { client, prompt, referenceImages, aspectRatio, timeoutMs } = options;

  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
  for (const img of referenceImages) {
    const parsed = parseReferenceDataUrl(img);
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }
  if (parts.length === 0) {
    throw new Error("参考图格式无法解析（需要 base64 data URL）");
  }
  parts.push({ text: prompt });

  const response = await withAbortTimeout(timeoutMs, (signal) =>
    client.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: resolveGeminiAspectRatio(aspectRatio) },
        abortSignal: signal,
      },
    })
  );

  const inlineParts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of inlineParts) {
    const data = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
    if (data?.data) {
      return `data:${data.mimeType || "image/png"};base64,${data.data}`;
    }
  }
  throw new Error("Gemini 未返回图像数据（可能被安全策略拦截，或模型不支持图像输出）");
}

type ChatMessageParam = OpenAI.ChatCompletionMessageParam;

async function createChatImageContent(
  client: OpenAI,
  params: {
    model: string;
    messages: ChatMessageParam[];
    temperature: number;
    max_tokens: number;
  },
  timeoutMs: number
): Promise<string> {
  if (isChatImageModel(params.model)) {
    try {
      const stream = await withAbortTimeout(timeoutMs, (signal) =>
        client.chat.completions.create(
          {
            ...params,
            stream: true,
          },
          { signal }
        )
      );

      let content = "";
      for await (const chunk of stream as AsyncIterable<any>) {
        content += chunk.choices?.[0]?.delta?.content ?? "";
      }
      if (content.trim()) return content;
      throw new Error("Streaming chat image response was empty");
    } catch (streamErr) {
      const streamMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      const canRetryNonStream =
        /stream/i.test(streamMsg) &&
        /not support|unsupported|invalid|unknown parameter|400/i.test(streamMsg);

      if (!canRetryNonStream) {
        throw streamErr;
      }

      console.warn(
        "[image-gen] streaming chat image request failed, retrying non-stream:",
        streamMsg
      );
    }
  }

  const chatRes = await withAbortTimeout(timeoutMs, (signal) =>
    client.chat.completions.create(params, { signal })
  );
  return chatRes.choices?.[0]?.message?.content ?? "";
}

/**
 * 判断模型是否只能通过 chat.completions 出图（如 gpt-image-2）
 */
function isChatImageModel(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes("gpt-image") || lower.includes("image-gen");
}

function prefersOpenAIImagesApi(model: string): boolean {
  const lower = model.toLowerCase();
  return (
    lower.includes("gpt-image") ||
    lower.includes("chatgpt-image")
  );
}

function resolveOpenAIGptImageSize(aspectRatio?: string): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  switch (aspectRatio) {
    case "16:9":
    case "4:3":
      return "1536x1024";
    case "9:16":
    case "3:4":
      return "1024x1536";
    case "1:1":
      return "1024x1024";
    default:
      return "auto";
  }
}

async function dataUrlToUploadable(dataUrl: string, index: number) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    throw new Error("参考图必须是 base64 data URL，当前图片无法通过 images.edit 上传。");
  }
  const mimeType = match[1].trim() || "image/png";
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg")
    ? "jpg"
    : mimeType.includes("webp")
      ? "webp"
      : "png";
  return toFile(Buffer.from(match[2].replace(/\s/g, ""), "base64"), `reference-${index}.${ext}`, {
    type: mimeType,
  });
}

async function imageResponseToDataUrl(response: any): Promise<string> {
  const first = response.data?.[0];

  if (first?.url) {
    try {
      return await fetchImageUrlAsDataUrl(first.url, 15_000);
    } catch (downloadErr) {
      console.warn("[image-gen] Failed to download image from URL, returning raw URL:", downloadErr);
      return first.url;
    }
  }

  const b64 = first?.b64_json ?? first?.base64 ?? first?.image;
  if (typeof b64 === "string" && b64.length > 100) {
    return `data:image/png;base64,${b64}`;
  }

  const raw = JSON.stringify(response, null, 2);
  console.error("[image-gen] OpenAI compatible response missing url/b64_json:", raw);
  throw new Error(`OpenAI image API did not return usable image data. Raw response:\n${raw.slice(0, 800)}`);
}

function describeImageResponse(response: any): string {
  const first = response?.data?.[0];
  if (!first) return "without data[0]";
  const fields = Object.keys(first).join(",") || "no fields";
  const url = typeof first.url === "string" ? "url" : "";
  const b64 = typeof first.b64_json === "string" ? "b64_json" : "";
  const useful = [url, b64].filter(Boolean).join("/") || "no url/b64_json";
  return `data[0] fields: ${fields}; ${useful}`;
}

async function fetchImageUrlAsDataUrl(url: string, timeoutMs: number): Promise<string> {
  return withAbortTimeout(timeoutMs, async (signal) => {
    const fetchRes = await fetch(url, { signal });
    if (!fetchRes.ok) {
      throw new Error(`Failed to download generated image: ${fetchRes.status}`);
    }
    const blob = await fetchRes.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = blob.type || "image/png";
    return `data:${mimeType};base64,${base64}`;
  });
}

async function tryOpenAIImageEditGen(
  client: OpenAI,
  model: string,
  finalPrompt: string,
  referenceImages: string[],
  aspectRatio: string | undefined,
  timeoutMs: number,
  logId: string
): Promise<string> {
  try {
    const imageFiles = await Promise.all(
      referenceImages.slice(0, 16).map((img, index) => dataUrlToUploadable(img, index))
    );
    updateLog(logId, {
      result: `calling images.edit with ${imageFiles.length} reference image(s) (SDK retries disabled)`,
    });
    const response = await withAbortTimeout(timeoutMs, (signal) =>
      client.images.edit(
        {
          model,
          image: imageFiles,
          prompt: finalPrompt,
          size: resolveOpenAIGptImageSize(aspectRatio),
          n: 1,
          quality: "auto",
          input_fidelity: "high",
        },
        { signal }
      )
    );
    updateLog(logId, {
      result: `images.edit returned ${describeImageResponse(response)}; resolving image`,
    });
    return imageResponseToDataUrl(response);
  } catch (editErr) {
    const editMsg = editErr instanceof Error ? editErr.message : String(editErr);
    console.warn("[image-gen] images.edit failed:", editMsg);
    const classified = classifyImageError(`images.edit failed: ${editMsg}`);
    if (classified.kind === "reference-upload") {
      throw new ImageGenerationError(
        classified.kind,
        classified.message,
        classified.status
      );
    }
    throw editErr;
  }
}

async function tryOpenAIImageGen(
  client: OpenAI,
  model: string,
  finalPrompt: string,
  aspectRatio: string | undefined,
  timeoutMs: number,
  logId: string
): Promise<string> {
  let imgMsg = "";

  // 部分 GPT 图片模型应走标准 images.generate；只有旧的中转 chat-image 才跳过
  if (!isChatImageModel(model) || prefersOpenAIImagesApi(model)) {
    try {
      updateLog(logId, {
        result: "calling images.generate (SDK retries disabled)",
      });
      const response = await withAbortTimeout(timeoutMs, (signal) =>
        client.images.generate(
          {
            model,
            prompt: finalPrompt,
            size: prefersOpenAIImagesApi(model)
              ? resolveOpenAIGptImageSize(aspectRatio)
              : resolveOpenAIImageSize(aspectRatio) as "1024x1024" | "1792x1024" | "1024x1792",
            n: 1,
            ...(prefersOpenAIImagesApi(model) ? { quality: "auto" as const } : {}),
          },
          { signal }
        )
      );

      updateLog(logId, {
        result: `images.generate returned ${describeImageResponse(response)}; resolving image`,
      });
      return imageResponseToDataUrl(response);
    } catch (imgErr) {
      imgMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
      console.warn("[image-gen] images.generate failed:", imgMsg);

      const shouldFallback =
        imgMsg.toLowerCase().includes("not supported when using codex with a chatgpt account") ||
        imgMsg.toLowerCase().includes("codex with a chatgpt account") ||
        imgMsg.toLowerCase().includes("not supported") ||
        imgMsg.toLowerCase().includes("unsupported") ||
        imgMsg.includes("<!doctype") ||
        imgMsg.includes("<html") ||
        imgMsg.includes("Raw response:\n<!") ||
        imgMsg.includes("404") ||
        imgMsg.includes("not found") ||
        imgMsg.includes("No such File") ||
        imgMsg.includes("Unsupported URL") ||
        imgMsg.includes("does not support image generation") ||
        imgMsg.includes("Invalid URL") ||
        imgMsg.includes("timeout") ||
        imgMsg.includes("ETIMEDOUT") ||
        imgMsg.includes("timed out") ||
        imgMsg.includes("aborted") ||
        imgMsg.includes("Connection error");

      if (!shouldFallback) {
        throw imgErr;
      }

      if (prefersOpenAIImagesApi(model)) {
        throw imgErr;
      }

      console.warn("[image-gen] Trying chat.completions fallback...");
    }
  } else {
    console.log("[image-gen] Model", model, "detected as chat-image model, skipping images.generate");
  }

  // chat.completions fallback：适合 gpt-image-2 等通过对话接口出图的模型
  const content = await createChatImageContent(
    client,
    {
      model,
      messages: [
        { role: "system", content: "You are an image generation assistant. Generate a high-quality image according to the user's description. Return the image as a base64 data URL if possible, or describe it vividly if you cannot output images directly." },
        { role: "user", content: finalPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    },
    timeoutMs
  );
  updateLog(logId, {
    result: `chat fallback returned ${content.length} chars; parsing image URL/data`,
  });

  // 1. 尝试从 content 中提取 base64 data URL（支持裸文本、markdown、HTML img）
  const b64Patterns = [
    /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/,
    /<img[^>]+src=["']data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)["']/i,
  ];
  for (const pattern of b64Patterns) {
    const b64Match = content.match(pattern);
    if (b64Match && b64Match[1].length > 100) {
      const mimeType = content.match(/data:image\/([^;]+)/)?.[1] || "png";
      return `data:image/${mimeType};base64,${b64Match[1]}`;
    }
  }

  // 2. 尝试提取 markdown 图片链接并下载
  const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) {
    return fetchImageUrlAsDataUrl(mdMatch[1], 15_000).catch(() => mdMatch[1]);
  }

  // 3. 尝试提取 HTML img src 外链
  const imgUrlMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (imgUrlMatch) {
    return fetchImageUrlAsDataUrl(imgUrlMatch[1], 15_000).catch(() => imgUrlMatch[1]);
  }

  // 4. 尝试提取裸 URL（图片直链）
  const bareUrlMatch = content.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif))/i);
  if (bareUrlMatch) {
    return fetchImageUrlAsDataUrl(bareUrlMatch[1], 15_000).catch(() => bareUrlMatch[1]);
  }

  console.error("[image-gen] chat.completions fallback returned content without parseable image. Content preview:", content.slice(0, 600));
  throw new Error(
    `该中转站/模型不支持标准 images.generate 接口，chat.completions fallback 也未返回图片。原始错误：${imgMsg.slice(0, 300)}`
  );
}
