import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), "output");
const IMAGES_DIR = path.join(OUTPUT_DIR, "images");

/**
 * 确保目录存在
 */
async function ensureDirectories(): Promise<void> {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

/**
 * 生成唯一文件名
 */
function generateFilename(originalName: string): string {
  const ext = path.extname(originalName) || ".png";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `image-${timestamp}-${random}${ext}`;
}

/**
 * POST /api/upload-image
 * 上传图片到服务器，返回可访问的 URL
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDirectories();

    const body = await request.json();
    const { base64, url: directUrl } = body as { base64?: string; url?: string };

    let imageUrl: string;
    let filename: string;

    if (directUrl) {
      // 如果是 URL，直接返回
      return NextResponse.json({
        success: true,
        url: directUrl,
        filename: "remote",
      });
    }

    if (!base64) {
      return NextResponse.json(
        { success: false, error: "未提供图片数据" },
        { status: 400 }
      );
    }

    // 解析 base64
    const matches = base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { success: false, error: "无效的 base64 格式" },
        { status: 400 }
      );
    }

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const imageData = Buffer.from(matches[2], "base64");

    // 生成文件名
    filename = generateFilename(`image.${ext}`);
    const imagePath = path.join(IMAGES_DIR, filename);

    // 保存图片
    await fs.writeFile(imagePath, imageData);

    // 返回可访问的 URL
    imageUrl = `/api/media/images/${filename}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      filename,
    });
  } catch (err) {
    console.error("[UploadImage] 上传失败:", err);
    const message = err instanceof Error ? err.message : "上传失败";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
