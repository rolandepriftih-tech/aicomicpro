export type ImageErrorKind =
  | "auth"
  | "subscription"
  | "unsupported-model"
  | "unsupported-reference"
  | "reference-upload"
  | "weak-prompt"
  | "timeout"
  | "rate-limit"
  | "provider-bad-response"
  | "unknown";

export class ImageGenerationError extends Error {
  kind: ImageErrorKind;
  status: number;

  constructor(kind: ImageErrorKind, message: string, status = 400) {
    super(message);
    this.name = "ImageGenerationError";
    this.kind = kind;
    this.status = status;
  }
}

export function classifyImageError(raw: string): {
  kind: ImageErrorKind;
  message: string;
  status: number;
} {
  const lower = raw.toLowerCase();

  if (raw.includes("InvalidSubscription") || raw.includes("CodingPlan subscription")) {
    return {
      kind: "subscription",
      status: 402,
      message:
        "视觉引擎账号订阅无效或已过期：火山方舟返回 InvalidSubscription / CodingPlan subscription。请到火山方舟控制台开通或续费对应模型服务，或切换到可用的视觉引擎/API Key。",
    };
  }

  if (lower.includes("unauthorized") || lower.includes("invalid api key") || raw.includes("401")) {
    return {
      kind: "auth",
      status: 401,
      message: "视觉引擎鉴权失败：请检查 API Key、Base URL 和当前服务商是否匹配。",
    };
  }

  if (
    lower.includes("not supported when using codex with a chatgpt account") ||
    lower.includes("codex with a chatgpt account")
  ) {
    return {
      kind: "unsupported-model",
      status: 400,
      message:
        "当前视觉模型被服务商拒绝：该模型不支持使用 ChatGPT/Codex 账号形态调用。请在 GeekAI/中转站切换到 API 账号支持的绘图模型，或改用已验证可用的 gpt-image-2 / 其他视觉模型。",
    };
  }

  if (lower.includes("not supported model") || lower.includes("unsupported model") || raw.includes("404")) {
    return {
      kind: "unsupported-model",
      status: 400,
      message: "当前视觉模型不被服务商支持：请检查模型名大小写、Base URL，或切换到可用模型。",
    };
  }

  if (raw.includes("chat.completions 未返回可解析的图片数据")) {
    return {
      kind: "provider-bad-response",
      status: 502,
      message:
        "当前中转站或模型没有返回图片数据。关联资产生图需要支持参考图/多模态生图的模型与接口，请切换到支持参考图生图的视觉模型，或先移除参考连线再生成。",
    };
  }

  if (
    lower.includes("images.edit") &&
    (lower.includes("connection error") ||
      lower.includes("fetch failed") ||
      lower.includes("socket") ||
      lower.includes("network"))
  ) {
    return {
      kind: "reference-upload",
      status: 502,
      message:
        "参考图生图在上传/编辑接口连接失败：当前请求走的是 images.edit（带关联资产/参考图），连接在本地服务到中转站之间中断，所以 Geek 后台可能看不到这次失败记录。请先减少参考图数量、改用不带参考图生成，或确认中转站是否支持 images.edit 多图上传。",
    };
  }

  if (raw.includes("Image generation timeout")) {
    return {
      kind: "timeout",
      status: 504,
      message: "视觉引擎请求超时。参考图越多越容易变慢，请减少关联资产数量、降低并发，或换用响应更稳定的模型。",
    };
  }

  if (raw.includes("429") || lower.includes("rate limit")) {
    return {
      kind: "rate-limit",
      status: 429,
      message: "视觉引擎限流：请降低并发，稍后重试，或切换到额度更充足的模型/API Key。",
    };
  }

  return { kind: "unknown", message: raw, status: 502 };
}
