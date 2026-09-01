import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { resolveImagenModelId } from "@/lib/model-capabilities";
import { generateImage } from "@/lib/image-gen";
import { DEFAULT_STYLE, getImagePrefix } from "@/lib/style-config";
import { isWeakImagePrompt } from "@/lib/image-prompts/build-image-prompt";
import { ImageGenerationError, classifyImageError } from "@/lib/image-errors";
import {
  enqueueImageGenerationJob,
  getImageGenerationJob,
} from "@/lib/image-generation-jobs";
import { getImageModelCapabilities } from "@/lib/model-capabilities";
import {
  normalizeImageReferenceMode,
  normalizeImageTimeoutMs,
  selectReferenceImagesForMode,
  type ImageReferenceMode,
} from "@/lib/image-runtime-options";
import type {
  ImageAssetType,
  ImageReferenceMeta,
  ImageTaskType,
} from "@/lib/image-generation-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GenerateImageBody = {
  prompt: string;
  assetName: string;
  apiKey?: string;
  imageProvider?: "gemini" | "openai";
  imageEngine?: "nano-banana-2" | "nano-banana-pro";
  imageModel?: string;
  aspectRatio?: string;
  baseUrl?: string;
  /** 画面风格枚举值，例如 anime/comic/cinematic/cyberpunk */
  style?: string;
  taskType?: ImageTaskType;
  assetType?: ImageAssetType;
  /** 资产参考图 base64 data URL（单张，兼容旧逻辑） */
  referenceImage?: string;
  /** 多资产参考图 base64 data URL 数组 */
  referenceImages?: string[];
  referenceMetas?: ImageReferenceMeta[];
  referenceMode?: ImageReferenceMode;
  timeoutMs?: number;
  async?: boolean;
};


function resolveStyle(raw?: string): {
  key: string;
  label: string;
  prefix: string;
} {
  const v = (raw ?? "").trim() || DEFAULT_STYLE;
  const prefix = getImagePrefix(v);
  return {
    key: v,
    label: prefix ? `${v} style` : "默认风格",
    prefix: prefix || "",
  };
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (jobId) {
    const job = getImageGenerationJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: "未找到生图任务，可能已过期。", errorKind: "job-not-found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: job.status === "success",
      jobId: job.id,
      status: job.status,
      imageUrl: job.imageUrl,
      error: job.error,
    });
  }

  return NextResponse.json(
    {
      error:
        "请使用 POST 请求创建生图任务，或使用 GET /api/generate-image?jobId=... 查询任务状态。",
    },
    { status: 405 }
  );
}

export async function POST(request: Request) {
  let assetName = "未知资产";
  let aspectRatio = "16:9";
  let errorStatus = 502;
  let errorKind = "unknown";

  try {
    const body = (await request.json()) as GenerateImageBody;
    assetName = body.assetName?.trim() || assetName;
    aspectRatio = body.aspectRatio?.trim() || aspectRatio;

    const prompt = body.prompt?.trim();
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY;
    const styleInfo = resolveStyle(body.style);

    const imageProvider = body.imageProvider ?? "gemini";
    const taskType = body.taskType ?? "asset-custom";
    const targetModel =
      imageProvider === "gemini"
        ? resolveImagenModelId(
            (body.imageEngine as "nano-banana-2" | "nano-banana-pro") ??
              "nano-banana-2"
          )
        : body.imageModel?.trim() || "dall-e-3";
    const referenceImages = [
      ...(body.referenceImage ? [body.referenceImage] : []),
      ...(Array.isArray(body.referenceImages) ? body.referenceImages : []),
    ].filter((x, index, arr) => typeof x === "string" && x && arr.indexOf(x) === index);
    const referenceMode = normalizeImageReferenceMode(body.referenceMode);
    const activeReferenceImages = selectReferenceImagesForMode(
      referenceImages,
      referenceMode
    );
    const timeoutMs = normalizeImageTimeoutMs(body.timeoutMs);
    const capabilities = getImageModelCapabilities(imageProvider, targetModel);

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "缺少 prompt（资产视觉描述）。" },
        { status: 400 }
      );
    }
    if (!assetName) {
      return NextResponse.json(
        { success: false, error: "缺少 assetName（资产名称）。" },
        { status: 400 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "缺少 API Key（未在请求体或环境变量中提供）。" },
        { status: 401 }
      );
    }
    if (isWeakImagePrompt(prompt)) {
      throw new ImageGenerationError(
        "weak-prompt",
        "视觉描述太弱或只是数字/符号。请描述要生成的主体，例如“木屋外观设定图”“科幻能量核心道具”，如果想生成文字图，请写“画面中心是大号文字 123”。",
        400
      );
    }
    if (activeReferenceImages.length > 0 && !capabilities.supportsReferenceImage) {
      throw new ImageGenerationError(
        "unsupported-reference",
        `当前视觉模型 ${targetModel} 不支持参考图生图。请切换到支持参考图的模型，或移除关联资产/参考图后再生成。`,
        400
      );
    }

    const limitedReferenceImages = activeReferenceImages.slice(0, capabilities.maxReferenceImages);
    const limitedReferenceMetas = Array.isArray(body.referenceMetas)
      ? body.referenceMetas.slice(0, limitedReferenceImages.length)
      : undefined;

    const runGenerate = () =>
      generateImage({
        provider: imageProvider,
        baseUrl: body.baseUrl,
        apiKey,
        model: targetModel,
        prompt,
        aspectRatio,
        stylePrefix: styleInfo.prefix,
        taskType,
        assetType: body.assetType,
        assetName,
        referenceImages: limitedReferenceImages,
        referenceMetas: limitedReferenceMetas,
        timeoutMs,
    });

    if (body.async !== false) {
      const job = enqueueImageGenerationJob(runGenerate);
      return NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: job.status,
          assetName,
        },
        { status: 202 }
      );
    }

    const { imageUrl } = await runGenerate();

    return NextResponse.json({
      success: true,
      imageUrl,
      assetName,
    });
  } catch (err) {
    const classified =
      err instanceof ImageGenerationError
        ? { kind: err.kind, message: err.message, status: err.status }
        : classifyImageError(getErrorMessage(err));
    const raw = classified.message;
    errorKind = classified.kind;
    errorStatus = classified.status;

    if (errorStatus < 500) {
      return NextResponse.json(
        {
          success: false,
          assetName,
          error: raw,
          errorKind,
        },
        { status: errorStatus }
      );
    }

    // 终极防裂图：返回一张 SVG Base64 兜底图，前端仍可渲染
    let width = 800;
    let height = 800;
    if (aspectRatio === "16:9") {
      width = 1920;
      height = 1080;
    } else if (aspectRatio === "9:16") {
      width = 1080;
      height = 1920;
    } else if (aspectRatio === "3:4") {
      width = 768;
      height = 1024;
    } else if (aspectRatio === "4:3") {
      width = 1024;
      height = 768;
    }
    const safeName = String(assetName || "未知资产").replace(/</g, "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0b0b0b"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#666" font-size="18" font-family="system-ui, -apple-system, BlinkMacSystemFont">API 错误 / ${safeName}</text></svg>`;
    const fallbackUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString(
      "base64"
    )}`;

    return NextResponse.json(
      {
        success: false,
        imageUrl: fallbackUrl,
        assetName,
        isFallback: true,
        error: raw,
        errorKind,
      },
      { status: errorStatus }
    );
  }
}
