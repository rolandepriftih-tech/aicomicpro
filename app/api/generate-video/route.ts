import { NextResponse } from "next/server";
import {
  enqueueVideoGenerationJob,
  getVideoGenerationJob,
} from "@/lib/video-generation-jobs";
import {
  generateVideo,
  resolveVideoMode,
  type VideoGenerationKind,
  type VideoEngine,
  type VideoGenerationMode,
} from "@/lib/video-gen";
import {
  normalizeSeedanceVideoDuration,
  normalizeSeedanceVideoRatio,
  normalizeSeedanceVideoResolution,
} from "@/lib/video-options";
import { downloadVideo, generatePreview, cleanupOldVideos } from "@/lib/video-save";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GenerateVideoBody = {
  /** 直接指定 mode（旧接口，兼容） */
  mode?: VideoGenerationMode;
  /** 引擎 + 生成方式（新接口，二选一） */
  engine?: VideoEngine;
  kind?: VideoGenerationKind;
  prompt?: string;
  panelId?: number;
  referenceImages?: string[];
  referenceAudios?: string[];
  duration?: number;
  aspectRatio?: string;
  quality?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: "ark" | "zizidonghua" | "autodl";
  timeoutMs?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  async?: boolean;
  /** AutoDL 专用：workflow ID */
  workflowId?: string;
};

type VideoGenerationResult = {
  videoUrl?: string;
  previewUrl?: string;
  promptExportUrl?: string;
  prompt?: string;
  mode?: string;
  downloadFailed?: boolean;
};

function buildPromptExport(body: Required<Pick<GenerateVideoBody, "mode" | "prompt">> & GenerateVideoBody) {
  const lines = [
    "# Video prompt export",
    "",
    `mode: ${body.mode}`,
    body.panelId ? `panelId: ${body.panelId}` : undefined,
    body.duration ? `duration: ${body.duration}s` : undefined,
    body.aspectRatio ? `aspectRatio: ${body.aspectRatio}` : undefined,
    body.quality ? `quality: ${body.quality}` : undefined,
    typeof body.generateAudio === "boolean"
      ? `generateAudio: ${body.generateAudio}`
      : undefined,
    typeof body.watermark === "boolean"
      ? `watermark: ${body.watermark}`
      : undefined,
    `referenceImages: ${body.referenceImages?.length ?? 0}`,
    "",
    "## Prompt",
    "",
    body.prompt,
  ].filter(Boolean);

  return lines.join("\n");
}

function toTextDataUrl(text: string) {
  return `data:text/markdown;charset=utf-8;base64,${Buffer.from(text).toString("base64")}`;
}

async function runVideoGeneration(body: Required<Pick<GenerateVideoBody, "mode" | "prompt">> & GenerateVideoBody): Promise<VideoGenerationResult> {
  const isZzdh = body.mode.startsWith("zzdh-") || body.provider === "zizidonghua";
  const isAutoDL = body.mode.startsWith("autodl-") || body.provider === "autodl";

  // 获取 API Key（AutoDL 使用 AUTODL_TOKEN）
  let apiKey = body.apiKey?.trim();
  if (!apiKey) {
    if (isAutoDL) {
      apiKey = process.env.AUTODL_TOKEN?.trim();
    } else if (isZzdh) {
      apiKey = process.env.ZZDH_API_KEY?.trim() || process.env.ZIZIDONGHUA_API_KEY?.trim();
    } else {
      apiKey = process.env.ARK_VIDEO_API_KEY?.trim() || process.env.SEEDANCE_API_KEY?.trim() || process.env.VIDEO_API_KEY?.trim();
    }
  }

  if (!apiKey) {
    const promptExport = buildPromptExport(body);
    return {
      promptExportUrl: toTextDataUrl(promptExport),
      prompt: body.prompt,
      mode: body.mode,
    };
  }

  // 生成视频
  console.log("[generate-video] 开始生成:", {
    provider: isAutoDL ? "autodl" : (isZzdh ? "zizidonghua" : (body.provider ?? "ark")),
    mode: body.mode,
    prompt: body.prompt,
    referenceImages: body.referenceImages,
    duration: body.duration,
    quality: body.quality,
  });
  const result = await generateVideo({
    provider: isAutoDL ? "autodl" : (isZzdh ? "zizidonghua" : (body.provider ?? "ark")),
    apiKey,
    baseUrl: isAutoDL
      ? (body.baseUrl || process.env.AUTODL_BASE_URL || undefined)
      : isZzdh
        ? (body.baseUrl || process.env.ZZDH_BASE_URL || undefined)
        : (body.baseUrl || process.env.ARK_VIDEO_BASE_URL || process.env.SEEDANCE_VIDEO_BASE_URL),
    model: body.model || (isZzdh || isAutoDL ? undefined : (process.env.ARK_VIDEO_MODEL || process.env.SEEDANCE_VIDEO_MODEL)),
    mode: body.mode,
    prompt: body.prompt,
    referenceImages: body.referenceImages,
    referenceAudios: body.referenceAudios,
    duration: isZzdh || isAutoDL ? body.duration : normalizeSeedanceVideoDuration(body.duration),
    aspectRatio: isZzdh || isAutoDL ? (body.aspectRatio || "vertical") : normalizeSeedanceVideoRatio(body.aspectRatio),
    quality: isAutoDL ? (body.quality || "480p竖") : normalizeSeedanceVideoResolution(body.quality),
    generateAudio: body.generateAudio ?? true,
    watermark: body.watermark ?? false,
    timeoutMs: body.timeoutMs,
    workflowId: body.workflowId,
  });

  // AutoDL：下载视频并生成预览
  let previewUrl = result.videoUrl;
  let downloadFailed = false;
  if (isAutoDL && result.videoUrl) {
    try {
      const taskId = `autodl-${Date.now()}`;
      const videoPath = await downloadVideo(result.videoUrl, taskId);
      const previewPath = await generatePreview(videoPath, taskId);

      // 生成相对 URL（通过 media 路由访问）
      // path.relative 返回 "output/videos/xxx.mp4"，但 media API 期望 "videos/xxx.mp4"
      // 所以需要去掉 "output/" 前缀
      const videoRelativePath = path.relative(path.join(process.cwd(), "output"), videoPath);
      const previewRelativePath = path.relative(path.join(process.cwd(), "output"), previewPath);

      previewUrl = `/api/media/${previewRelativePath}`;
      return {
        videoUrl: `/api/media/${videoRelativePath}`,
        previewUrl,
        prompt: body.prompt,
        mode: body.mode,
      };
    } catch (error) {
      console.error("AutoDL 视频下载/预览生成失败:", error);
      // 下载失败仍返回原始 URL，并标记下载失败
      downloadFailed = true;
    }
  }

  return {
    videoUrl: result.videoUrl,
    previewUrl,
    prompt: body.prompt,
    mode: body.mode,
    downloadFailed,
  };
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (!jobId) {
    return NextResponse.json(
      {
        error:
          "请使用 POST 请求创建视频任务，或使用 GET /api/generate-video?jobId=... 查询任务状态。",
      },
      { status: 405 }
    );
  }

  const job = getVideoGenerationJob(jobId);
  if (!job) {
    return NextResponse.json(
      { success: false, error: "未找到视频任务，可能已过期。", errorKind: "job-not-found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: job.status === "success",
    jobId: job.id,
    status: job.status,
    videoUrl: job.videoUrl,
    promptExportUrl: job.promptExportUrl,
    prompt: job.prompt,
    mode: job.mode,
    error: job.error,
    outputType: job.videoUrl ? "video" : job.promptExportUrl ? "prompt-export" : undefined,
  });
}

export async function POST(request: Request) {
  try {
    // 启动时清理旧文件（非阻塞）
    cleanupOldVideos().catch(() => {});

    const body = (await request.json()) as GenerateVideoBody;
    let mode = body.mode;
    const prompt = body.prompt?.trim();

    // 支持 engine + kind 模式（新接口）
    if (!mode && body.engine && body.kind) {
      try {
        mode = resolveVideoMode(body.engine, body.kind);
      } catch (err) {
        return NextResponse.json(
          { success: false, error: err instanceof Error ? err.message : "不支持的引擎×生成方式组合" },
          { status: 400 }
        );
      }
    }

    const validModes = [
      "seedance-text-to-video",
      "seedance-image-to-video",
      "zzdh-text-to-video",
      "zzdh-first-last-frame",
      "zzdh-multi-reference",
      "zzdh-multi-image-audio",
      "zzdh-lip-sync",
      "autodl-text-to-video",
      "autodl-first-last-frame",
      "autodl-multi-reference",
      "autodl-multi-image-audio",
      "autodl-lip-sync",
    ];
    if (!mode || !validModes.includes(mode)) {
      return NextResponse.json(
        { success: false, error: "不支持的视频生成模式。请提供 mode 或 engine+kind。" },
        { status: 400 }
      );
    }
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "缺少 prompt（视频提示词）。" },
        { status: 400 }
      );
    }
    if (mode === "seedance-image-to-video" && !body.referenceImages?.length) {
      return NextResponse.json(
        { success: false, error: "图生视频需要至少一张参考图。" },
        { status: 400 }
      );
    }

    const isZzdh = mode.startsWith("zzdh-") || body.provider === "zizidonghua";
    const isAutoDL = mode.startsWith("autodl-") || body.provider === "autodl";

    const normalizedBody = {
      ...body,
      mode,
      prompt,
      referenceImages: Array.isArray(body.referenceImages)
        ? body.referenceImages.filter((x) => typeof x === "string" && x)
        : [],
      referenceAudios: Array.isArray(body.referenceAudios)
        ? body.referenceAudios.filter((x) => typeof x === "string" && x)
        : [],
      duration: isZzdh || isAutoDL ? body.duration : normalizeSeedanceVideoDuration(body.duration),
      aspectRatio: isZzdh || isAutoDL ? (body.aspectRatio || "vertical") : normalizeSeedanceVideoRatio(body.aspectRatio),
      quality: isAutoDL ? (body.quality || "480p竖") : normalizeSeedanceVideoResolution(body.quality),
      generateAudio: body.generateAudio ?? true,
      watermark: body.watermark ?? false,
      workflowId: body.workflowId,
    };

    if (body.async !== false) {
      const job = enqueueVideoGenerationJob(() => runVideoGeneration(normalizedBody));
      return NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: job.status,
        },
        { status: 202 }
      );
    }

    const result = await runVideoGeneration(normalizedBody);
    return NextResponse.json({
      success: true,
      ...result,
      outputType: result.videoUrl ? "video" : "prompt-export",
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "视频任务失败";
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}
