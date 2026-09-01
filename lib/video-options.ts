export type SeedanceVideoResolution = "480p" | "720p" | "1080p";
export type SeedanceVideoRatio =
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9"
  | "adaptive";

export type VideoGenerationQuality = SeedanceVideoResolution | "480p" | "768p";

export type VideoGenerationOptions = {
  duration?: number;
  aspectRatio?: SeedanceVideoRatio | "horizontal" | "vertical";
  quality?: VideoGenerationQuality;
  generateAudio?: boolean;
  watermark?: boolean;
  referenceAudios?: string[];
};

export const seedanceVideoResolutions: SeedanceVideoResolution[] = [
  "480p",
  "720p",
  "1080p",
];

export const seedanceVideoRatios: Array<{
  value: SeedanceVideoRatio;
  label: string;
}> = [
  { value: "16:9", label: "横屏" },
  { value: "9:16", label: "竖屏" },
  { value: "1:1", label: "方形" },
  { value: "4:3", label: "标准横屏" },
  { value: "3:4", label: "标准竖屏" },
  { value: "21:9", label: "宽银幕" },
  { value: "adaptive", label: "自适应" },
];

export const seedanceVideoDurations = [-1, 4, 5, 6, 8, 10, 12, 15] as const;

export function normalizeSeedanceVideoDuration(value: number | undefined): number {
  if (value === -1) return -1;
  const seconds = Math.floor(Number(value) || 5);
  return Math.max(4, Math.min(15, seconds));
}

export function normalizeSeedanceVideoResolution(
  value: string | undefined
): SeedanceVideoResolution {
  if (value === "480p" || value === "1080p") return value;
  return "720p";
}

export function normalizeSeedanceVideoRatio(
  value: string | undefined
): SeedanceVideoRatio {
  if (value && seedanceVideoRatios.some((item) => item.value === value)) {
    return value as SeedanceVideoRatio;
  }
  return "16:9";
}
