import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { generatePreview } from "@/lib/video-save";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), "output");
const VIDEOS_DIR = path.join(OUTPUT_DIR, "videos");
const PREVIEWS_DIR = path.join(OUTPUT_DIR, "previews");

/**
 * 确保目录存在
 */
async function ensureDirectories(): Promise<void> {
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
  await fs.mkdir(PREVIEWS_DIR, { recursive: true });
}

/**
 * 从 JSON 中提取视频 URL
 */
function extractVideoUrl(jsonStr: string): string | null {
  try {
    // 尝试解析 JSON
    let data: unknown;

    // 可能是数组格式 [{...}] 或对象格式 {...}
    const trimmed = jsonStr.trim();
    if (trimmed.startsWith("[")) {
      data = JSON.parse(trimmed);
      // 如果是数组，取第一个元素
      if (Array.isArray(data) && data.length > 0) {
        data = data[0];
      }
    } else if (trimmed.startsWith("{")) {
      data = JSON.parse(trimmed);
    } else {
      // 可能是直接的 URL
      if (trimmed.startsWith("http") && trimmed.includes(".mp4")) {
        return trimmed;
      }
      return null;
    }

    // 提取 url 字段
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;

      // 尝试多种字段名
      const urlFields = ["url", "videoUrl", "video_url", "output", "download_url"];
      for (const field of urlFields) {
        const value = obj[field];
        if (typeof value === "string" && value.startsWith("http")) {
          return value;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 生成唯一文件名
 */
function generateFilename(url: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // 尝试从 URL 中提取原始文件名
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const basename = path.basename(pathname);
    if (basename && basename.includes(".")) {
      return `autodl-${timestamp}-${random}-${basename}`;
    }
  } catch {
    // ignore
  }

  return `autodl-${timestamp}-${random}.mp4`;
}

/**
 * POST /api/import-video-url
 * 从远程 URL 下载视频
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDirectories();

    const body = await request.json();
    const { json, url: directUrl } = body as { json?: string; url?: string };

    // 提取视频 URL
    let videoUrl = directUrl;
    if (!videoUrl && json) {
      videoUrl = extractVideoUrl(json) ?? undefined;
    }

    if (!videoUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "无法从输入中提取视频 URL，请检查 JSON 格式或直接输入视频链接"
        },
        { status: 400 }
      );
    }

    // 验证 URL
    if (!videoUrl.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "无效的视频 URL" },
        { status: 400 }
      );
    }

    // 生成文件名
    const filename = generateFilename(videoUrl);
    const videoPath = path.join(VIDEOS_DIR, filename);

    // 下载视频
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 分钟超时

    try {
      const response = await fetch(videoUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`下载失败：${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(videoPath, Buffer.from(buffer));
    } finally {
      clearTimeout(timeoutId);
    }

    // 生成预览版
    let previewPath: string;
    try {
      previewPath = await generatePreview(videoPath, filename.replace(/\.[^.]+$/, ""));
    } catch (err) {
      console.warn("[ImportVideoUrl] 生成预览失败，使用原文件:", err);
      previewPath = videoPath;
    }

    // 计算相对路径
    const videoRelativePath = path.relative(OUTPUT_DIR, videoPath);
    const previewRelativePath = path.relative(OUTPUT_DIR, previewPath);

    // 返回可访问的 URL
    const localVideoUrl = `/api/media/${videoRelativePath}`;
    const localPreviewUrl = `/api/media/${previewRelativePath}`;

    return NextResponse.json({
      success: true,
      videoUrl: localVideoUrl,
      previewUrl: localPreviewUrl,
      filename,
      originalUrl: videoUrl,
    });
  } catch (err) {
    console.error("[ImportVideoUrl] 导入失败:", err);
    const message = err instanceof Error ? err.message : "导入失败";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
