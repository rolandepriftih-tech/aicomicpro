import type { Edge, Node } from "@xyflow/react";
import type {
  ImageAssetType,
  ImageReferenceMeta,
  ImageReferenceType,
  ImageTaskType,
} from "@/lib/image-generation-types";

export type Plan4Node = Node<Record<string, unknown>>;

export interface ConnectedReferenceItem {
  url: string;
  name: string;
  type: string;
}

export function resolveNodeAssetType(node?: Plan4Node): ImageAssetType | undefined {
  if (!node || node.type !== "asset") return undefined;
  const raw = node.data.assetType;
  if (
    raw === "character" ||
    raw === "scene" ||
    raw === "prop" ||
    raw === "creature" ||
    raw === "cockpit" ||
    raw === "custom"
  ) {
    return raw;
  }
  return "custom";
}

export function resolveNodeTaskType(
  nodeId: string,
  node?: Plan4Node
): { taskType: ImageTaskType; assetType?: ImageAssetType } {
  if (node?.type === "panel" || nodeId.startsWith("panel-")) {
    return { taskType: "panel-storyboard" };
  }

  const assetType = resolveNodeAssetType(node);
  switch (assetType) {
    case "character":
      return { taskType: "asset-character", assetType };
    case "scene":
      return { taskType: "asset-scene", assetType };
    case "prop":
      return { taskType: "asset-prop", assetType };
    case "creature":
      return { taskType: "asset-creature", assetType };
    case "cockpit":
      return { taskType: "asset-cockpit", assetType };
    default:
      return { taskType: "asset-custom", assetType: assetType ?? "custom" };
  }
}

export function normalizeReferenceType(raw: string): ImageReferenceType {
  if (
    raw === "character" ||
    raw === "scene" ||
    raw === "prop" ||
    raw === "creature" ||
    raw === "cockpit" ||
    raw === "panel" ||
    raw === "style"
  ) {
    return raw;
  }
  return "reference";
}

export function addReferenceImage(
  images: string[],
  metas: ImageReferenceMeta[],
  url: string | undefined,
  meta: ImageReferenceMeta
) {
  if (!url || images.includes(url)) return;
  images.push(url);
  metas.push(meta);
}

export function collectConnectedReferenceItems({
  nodeId,
  edges,
  nodes,
  assetImageUrls,
  assetReferenceImages,
  panelImageUrls,
}: {
  nodeId: string;
  edges: Edge[];
  nodes: Plan4Node[];
  assetImageUrls?: Record<string, string>;
  assetReferenceImages?: Record<string, string>;
  panelImageUrls?: Record<string, string>;
}): ConnectedReferenceItem[] {
  const items: ConnectedReferenceItem[] = [];

  edges.forEach((edge) => {
    if (edge.target !== nodeId) return;

    const sourceNode = nodes.find((node) => node.id === edge.source);
    if (!sourceNode) return;

    const sourceData = sourceNode.data;
    const isSourceAsset = sourceNode.type === "asset";
    const sourceName = isSourceAsset
      ? (sourceData.name as string)
      : `Panel ${(sourceData.panelId as number) ?? ""}`;
    const sourceType = isSourceAsset
      ? (sourceData.assetType as string) || "asset"
      : "panel";
    const imageUrl = isSourceAsset
      ? assetImageUrls?.[sourceName] ||
        assetImageUrls?.[sourceNode.id] ||
        (sourceData.imageUrl as string) ||
        assetReferenceImages?.[sourceName] ||
        assetReferenceImages?.[sourceNode.id] ||
        (sourceData.referenceImage as string)
      : panelImageUrls?.[sourceNode.id] || (sourceData.imageUrl as string);

    if (imageUrl && !items.some((item) => item.url === imageUrl)) {
      items.push({
        url: imageUrl,
        name: sourceName || sourceNode.id,
        type: sourceType,
      });
    }
  });

  return items;
}

export function hasContinuesInput(
  nodeId: string,
  edges: Edge[],
  nodes: Plan4Node[]
): boolean {
  return edges.some((edge) => {
    if (edge.target !== nodeId) return false;
    if ((edge.data as { semanticType?: string } | undefined)?.semanticType !== "continues") {
      return false;
    }
    return nodes.some((node) => node.id === edge.source);
  });
}
