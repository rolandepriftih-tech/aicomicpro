export type ImageReferenceMode = "auto" | "off" | "image-edit";

const DEFAULT_TIMEOUT_MS = 600_000;
const MIN_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 600_000;

export function normalizeImageReferenceMode(
  raw?: unknown
): ImageReferenceMode {
  return raw === "off" || raw === "image-edit" ? raw : "auto";
}

export function selectReferenceImagesForMode(
  referenceImages: string[],
  mode: ImageReferenceMode
): string[] {
  if (mode === "off") return [];
  return referenceImages;
}

export function normalizeImageTimeoutMs(raw?: unknown): number {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : DEFAULT_TIMEOUT_MS;

  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(value)));
}
