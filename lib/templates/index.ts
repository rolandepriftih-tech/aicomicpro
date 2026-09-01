/**
 * 模板系统统一导出
 *
 * 包含:
 * 1. StoryboardTemplateEngine - 分镜图模板引擎
 * 2. SceneReferenceGenerator - 场景预制作参考板
 * 3. DirectorPromptBuilder - 导演级提示词构建器
 * 4. AssetDesignSheetGenerator - 资产设计表
 */

// ============================================
// 类型导出
// ============================================

export type {
  StoryboardPanel,
  GenerationMode,
  CinematographyConfig,
  StoryboardImageTemplate,
  SceneReferenceTemplate,
  CharacterDesignSheet,
  SceneDesignSheet,
  PropDesignSheet,
  DesignSheet,
  DesignSheetType,
  SeedanceVideoPrompt,
} from "./storyboard-template";

// ============================================
// 模板生成函数导出
// ============================================

export {
  // 分镜图模板
  generateStoryboardImagePrompt,

  // 场景参考板模板
  generateSceneReferencePrompt,

  // 资产设计表
  generateCharacterDesignSheetPrompt,
  generateSceneDesignSheetPrompt,
  generatePropDesignSheetPrompt,

  // Seedance视频提示词
  generateSeedanceVideoPrompt,

  // 模板匹配器
  matchTemplateForMode,
  batchGeneratePrompts,
} from "./storyboard-template";

// 常量从选择器组件导出
export { GENERATION_MODES } from "@/components/plan4-canvas/generation-modes/GenerationModeSelector";

// ============================================
// 提示词构建器导出
// ============================================

export {
  StoryboardPromptBuilder,
  StoryboardPromptBuilderAPI,
  batchBuildPrompts as batchBuildPromptsFromBuilder,
} from "@/lib/prompt-builders/storyboard-prompt-builder";

export type {
  PromptBuilderContext,
  BuiltPrompt,
  BatchBuildOptions,
} from "@/lib/prompt-builders/storyboard-prompt-builder";

// ============================================
// 生图模式选择器导出
// ============================================

export {
  GenerationModeSelector,
  GENERATION_MODES as GENERATION_MODE_OPTIONS,
} from "@/components/plan4-canvas/generation-modes/GenerationModeSelector";

export type {
  GenerationModeOption,
  GenerationModeSelectorProps,
} from "@/components/plan4-canvas/generation-modes/GenerationModeSelector";

// ============================================
// 便捷统一入口
// ============================================

import type { StoryboardPanel, GenerationMode } from "./storyboard-template";
import type { PromptBuilderContext } from "@/lib/prompt-builders/storyboard-prompt-builder";
import { StoryboardPromptBuilder } from "@/lib/prompt-builders/storyboard-prompt-builder";

/**
 * 便捷函数：一键生成分镜提示词
 *
 * 使用示例:
 * ```typescript
 * const result = await generatePromptForPanel({
 *   panel: myPanel,
 *   mode: "gpt-image2-storyboard",
 *   context: {
 *     characters: [...],
 *     location: { name: "场景", description: "..." },
 *     artStyle: "赛博朋克"
 *   }
 * });
 * console.log(result.prompt);
 * ```
 */
export async function generatePromptForPanel({
  panel,
  mode,
  context,
}: {
  panel: StoryboardPanel;
  mode: GenerationMode;
  context: PromptBuilderContext;
}) {
  const builder = new StoryboardPromptBuilder(panel, context);
  return builder.build(mode);
}

/**
 * 便捷函数：批量生成分镜提示词
 */
export async function batchGeneratePromptsForPanels({
  panels,
  mode,
  context,
  onProgress,
}: {
  panels: StoryboardPanel[];
  mode: GenerationMode;
  context: PromptBuilderContext;
  onProgress?: (index: number, total: number) => void;
}) {
  const results = [];

  for (let i = 0; i < panels.length; i++) {
    const result = await generatePromptForPanel({
      panel: panels[i],
      mode,
      context,
    });
    results.push(result);
    onProgress?.(i + 1, panels.length);
  }

  return results;
}

// 默认导出
export default {
  generatePromptForPanel,
  batchGeneratePromptsForPanels,
};
