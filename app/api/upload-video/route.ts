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
 * 生成唯一文件名
 */
function generateFilename(originalName: string): string {
  const ext = path.extname(originalName) || ".mp4";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `imported-${timestamp}-${random}${ext}`;
}

/**
 * POST /api/upload-video
 * 上传视频文件到服务器
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDirectories();

    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "未找到视频文件" },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "不支持的视频格式，请上传 MP4、MOV、WebM 或 AVI 文件" },
        { status: 400 }
      );
    }

    // 验证文件大小（最大 500MB）
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "文件过大，最大支持 500MB" },
        { status: 400 }
      );
    }

    // 生成文件名
    const filename = generateFilename(file.name);
    const videoPath = path.join(VIDEOS_DIR, filename);

    // 保存视频文件
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(videoPath, buffer);

    // 生成预览版
    let previewPath: string;
    try {
      previewPath = await generatePreview(videoPath, filename.replace(/\.[^.]+$/, ""));
    } catch (err) {
      console.warn("[UploadVideo] 生成预览失败，使用原文件:", err);
      previewPath = videoPath;
    }

    // 计算相对路径
    const videoRelativePath = path.relative(OUTPUT_DIR, videoPath);
    const previewRelativePath = path.relative(OUTPUT_DIR, previewPath);

    // 返回可访问的 URL
    const videoUrl = `/api/media/${videoRelativePath}`;
    const previewUrl = `/api/media/${previewRelativePath}`;

    return NextResponse.json({
      success: true,
      videoUrl,
      previewUrl,
      filename,
      size: file.size,
    });
  } catch (err) {
    console.error("[UploadVideo] 上传失败:", err);
    const message = err instanceof Error ? err.message : "上传失败";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
