/**
 * 将前端传来的参考图 data URL 解析为 Gemini inlineData 所需字段。
 * 仅服务端使用；非法输入返回 null。
 */
export function parseReferenceDataUrl(
  input: string | undefined | null
): { mimeType: string; data: string } | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const trimmed = input.trim();
  const m = trimmed.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (m) {
    const mimeType = m[1].trim();
    const data = m[2].replace(/\s/g, "");
    if (!data || data.length < 32) return null;
    return { mimeType, data };
  }
  return null;
}
