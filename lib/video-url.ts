/**
 * 从媒体 URL 提取视频 taskId（文件名去 .mp4）。
 * 纯函数、无 Node 依赖，服务端（video-refs）与客户端（画布上报）共用。
 */
export function extractVideoTaskId(url: string | undefined | null): string | null {
  if (typeof url !== "string" || !url) return null;
  // 兼容 /api/media/videos/xxx.mp4、/api/media/output/videos/xxx.mp4（历史格式）、
  // /api/media/previews/xxx.mp4
  const m = url.match(/\/api\/media\/(?:output\/)?(?:videos|previews)\/([^/?#]+?)\.mp4(?:$|[?#])/);
  return m?.[1] ?? null;
}
