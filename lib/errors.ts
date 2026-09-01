/**
 * 统一的错误信息提取工具
 */

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const o = err as { error?: { message?: string }; message?: string };
  if (o?.error?.message) return o.error.message;
  if (typeof o?.message === "string") return o.message;
  return String(err);
}
