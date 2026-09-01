/**
 * 资产自动匹配工具
 * 将分镜中使用的资产名称（assetsUsed）与已有的资产列表做包含匹配
 */

/**
 * 检查两个名称是否互相包含（支持双向包含匹配）
 */
function isNameMatch(a: string, b: string): boolean {
  const ca = a.trim().toLowerCase();
  const cb = b.trim().toLowerCase();
  return ca.includes(cb) || cb.includes(ca);
}

/**
 * 从所有资产中，找出与 assetsUsed 匹配的资产名称
 * @param assetsUsed 分镜中声明使用的资产名称列表
 * @param allAssetNames 已有的所有资产名称列表（来自 analysisResult）
 * @returns 匹配到的资产名称列表
 */
export function matchAssets(
  assetsUsed: string[],
  allAssetNames: string[]
): string[] {
  if (!assetsUsed?.length || !allAssetNames?.length) return [];

  const matched = new Set<string>();

  for (const used of assetsUsed) {
    for (const name of allAssetNames) {
      if (isNameMatch(used, name)) {
        matched.add(name);
      }
    }
  }

  return Array.from(matched);
}

/**
 * 从 analysisResult 中提取所有资产名称
 */
export function extractAllAssetNames(
  analysisResult: {
    characters?: Array<{ name: string }>;
    creatures?: Array<{ name: string }>;
    scenes?: Array<{ name: string }>;
    props?: Array<{ name: string }>;
    cockpits?: Array<{ name: string }>;
  } | null
): string[] {
  if (!analysisResult) return [];

  const names: string[] = [];
  analysisResult.characters?.forEach((c) => names.push(c.name));
  analysisResult.creatures?.forEach((c) => names.push(c.name));
  analysisResult.scenes?.forEach((s) => names.push(s.name));
  analysisResult.props?.forEach((p) => names.push(p.name));
  analysisResult.cockpits?.forEach((c) => names.push(c.name));

  return names;
}

/**
 * 获取匹配资产的最佳参考图（优先用用户上传的参考图，次选AI生成的定妆图）
 */
export function resolveAssetReferenceImage(
  assetName: string,
  assetReferenceImages: Record<string, string>,
  assetImageUrls: Record<string, string>
): string | undefined {
  // 优先返回用户上传的参考图
  if (assetReferenceImages[assetName]) {
    return assetReferenceImages[assetName];
  }
  // 次选AI生成的定妆图
  if (assetImageUrls[assetName]) {
    return assetImageUrls[assetName];
  }
  return undefined;
}
