/**
 * API 请求相关的工具函数
 */

/**
 * 解析并规范化 baseUrl，排除 OpenAI 官方地址（无需代理）
 */
export function resolveBaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (
    lower.startsWith("https://api.openai.com/") ||
    lower.startsWith("http://api.openai.com/")
  ) {
    return undefined;
  }
  return v;
}
