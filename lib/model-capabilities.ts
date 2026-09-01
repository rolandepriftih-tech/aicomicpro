import type { ImageProvider } from "@/lib/image-gen";

export interface ModelCapabilities {
  supportsTextToImage: boolean;
  supportsReferenceImage: boolean;
  supportsMultiReference: boolean;
  supportsImageEdit: boolean;
  maxReferenceImages: number;
}

/** Imagen 3 已下线，统一走 Imagen 4。 */
export function resolveImagenModelId(
  engine: "nano-banana-2" | "nano-banana-pro"
): string {
  switch (engine) {
    case "nano-banana-pro":
      return "imagen-4.0-ultra-generate-001";
    case "nano-banana-2":
    default:
      return "imagen-4.0-fast-generate-001";
  }
}

export function getImageModelCapabilities(
  provider: ImageProvider,
  model: string
): ModelCapabilities {
  const lower = model.toLowerCase();

  if (provider === "gemini") {
    return {
      supportsTextToImage: true,
      supportsReferenceImage: true,
      supportsMultiReference: true,
      supportsImageEdit: false,
      maxReferenceImages: 3,
    };
  }

  if (lower.includes("dall-e")) {
    return {
      supportsTextToImage: true,
      supportsReferenceImage: false,
      supportsMultiReference: false,
      supportsImageEdit: false,
      maxReferenceImages: 0,
    };
  }

  if (lower.includes("gpt-image") || lower.includes("image-gen")) {
    return {
      supportsTextToImage: true,
      supportsReferenceImage: true,
      supportsMultiReference: true,
      supportsImageEdit: true,
      maxReferenceImages: 3,
    };
  }

  return {
    supportsTextToImage: true,
    supportsReferenceImage: false,
    supportsMultiReference: false,
    supportsImageEdit: false,
    maxReferenceImages: 0,
  };
}
