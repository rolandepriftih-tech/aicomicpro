/**
 * 分镜提示词构建器
 * 根据生图模式和分镜数据自动匹配对应模板，构建最终提示词
 */

import type {
  StoryboardPanel,
  GenerationMode,
} from "@/lib/templates/storyboard-template";
import {
  generateStoryboardImagePrompt,
  generateSeedanceVideoPrompt,
  generateCharacterDesignSheetPrompt,
} from "@/lib/templates/storyboard-template";

// ============================================
// 类型定义
// ============================================

export interface PromptBuilderContext {
  // 角色信息
  characters: {
    name: string;
    appearance: string;
    outfit: string;
    referenceImage?: string;
  }[];

  // 场景信息
  location: {
    name: string;
    description: string;
    referenceImage?: string;
  };

  // 道具
  props?: {
    name: string;
    description: string;
  }[];

  // 视觉风格
  artStyle: string;

  // 参考图
  referenceImages?: string[];
}

export interface BuiltPrompt {
  mode: GenerationMode;
  template: string;
  prompt: string;
  requiresReferenceImages: boolean;
  referenceTypes: ("character" | "scene" | "style")[];
  aspectRatio: string;
  duration?: number; // 视频时长
  quality?: string;
}

// ============================================
// 提示词构建器
// ============================================

export class StoryboardPromptBuilder {
  private panel: StoryboardPanel;
  private context: PromptBuilderContext;

  constructor(panel: StoryboardPanel, context: PromptBuilderContext) {
    this.panel = panel;
    this.context = context;
  }

  /**
   * 构建指定生图模式的提示词
   */
  build(mode: GenerationMode): BuiltPrompt {
    switch (mode) {
      case "gpt-image2-storyboard":
        return this.buildGPTImage2Storyboard();

      case "seedance-text-to-video":
        return this.buildSeedanceTextToVideo();

      case "seedance-image-to-video":
        return this.buildSeedanceImageToVideo();

      case "zzdh-text-to-video":
        return this.buildZzdhTextToVideo();

      case "zzdh-first-last-frame":
        return this.buildZzdhFirstLastFrame();

      case "zzdh-multi-reference":
        return this.buildZzdhMultiReference();

      case "zzdh-multi-image-audio":
        return this.buildZzdhMultiImageAudio();

      case "zzdh-lip-sync":
        return this.buildZzdhLipSync();

      case "asset-reference-sheet":
        return this.buildAssetReferenceSheet();

      default:
        throw new Error(`未知的生图模式: ${mode}`);
    }
  }

  /**
   * 方案1: GPT Image 2 分镜图
   */
  private buildGPTImage2Storyboard(): BuiltPrompt {
    const prompt = generateStoryboardImagePrompt(this.panel, {
      artStyle: this.context.artStyle,
      characters: this.context.characters.map((c) => ({
        name: c.name,
        appearance: c.appearance,
        outfit: c.outfit,
      })),
      location: this.context.location.name,
      mood: this.panel.chineseDirectorNotes,
      references: this.context.referenceImages,
    });

    return {
      mode: "gpt-image2-storyboard",
      template: "6模块分镜图",
      prompt,
      requiresReferenceImages: false,
      referenceTypes: [],
      aspectRatio: this.getAspectRatio(),
    };
  }

  /**
   * 方案2: Seedance 文生视频
   */
  private buildSeedanceTextToVideo(): BuiltPrompt {
    const prompt = generateSeedanceVideoPrompt(this.panel, {
      characters: this.context.characters.map((c) => c.name).join(", "),
      location: this.context.location.name,
      props: this.context.props?.map((p) => p.name).join(", "),
      visualStyle: this.context.artStyle,
    });

    return {
      mode: "seedance-text-to-video",
      template: "Seedance文生视频",
      prompt,
      requiresReferenceImages: false,
      referenceTypes: [],
      aspectRatio: this.getAspectRatio(),
      duration: 5, // 默认5秒
      quality: "2K",
    };
  }

  /**
   * 方案2变体: Seedance 图生视频
   */
  private buildSeedanceImageToVideo(): BuiltPrompt {
    // 与文生视频类似，但标记需要参考图
    const base = this.buildSeedanceTextToVideo();

    return {
      ...base,
      mode: "seedance-image-to-video",
      template: "Seedance图生视频",
      requiresReferenceImages: true,
      referenceTypes: ["character", "scene"],
    };
  }

  /**
   * 字字动画: 文生视频
   */
  private buildZzdhTextToVideo(): BuiltPrompt {
    const prompt = generateSeedanceVideoPrompt(this.panel, {
      characters: this.context.characters.map((c) => c.name).join(", "),
      location: this.context.location.name,
      props: this.context.props?.map((p) => p.name).join(", "),
      visualStyle: this.context.artStyle,
    });

    return {
      mode: "zzdh-text-to-video",
      template: "MiniMax H3 文生视频",
      prompt,
      requiresReferenceImages: false,
      referenceTypes: [],
      aspectRatio: "vertical",
      duration: 5,
      quality: "480p",
    };
  }

  /**
   * 字字动画: 首尾帧
   */
  private buildZzdhFirstLastFrame(): BuiltPrompt {
    const prompt = generateSeedanceVideoPrompt(this.panel, {
      characters: this.context.characters.map((c) => c.name).join(", "),
      location: this.context.location.name,
      props: this.context.props?.map((p) => p.name).join(", "),
      visualStyle: this.context.artStyle,
    });

    return {
      mode: "zzdh-first-last-frame",
      template: "MiniMax H3 首尾帧",
      prompt,
      requiresReferenceImages: true,
      referenceTypes: ["character", "scene"],
      aspectRatio: "vertical",
      duration: 5,
      quality: "480p",
    };
  }

  /**
   * 字字动画: 多参考图生
   */
  private buildZzdhMultiReference(): BuiltPrompt {
    const prompt = generateSeedanceVideoPrompt(this.panel, {
      characters: this.context.characters.map((c) => c.name).join(", "),
      location: this.context.location.name,
      props: this.context.props?.map((p) => p.name).join(", "),
      visualStyle: this.context.artStyle,
    });

    return {
      mode: "zzdh-multi-reference",
      template: "MiniMax H3 多参考图生",
      prompt,
      requiresReferenceImages: true,
      referenceTypes: ["character", "scene"],
      aspectRatio: "vertical",
      duration: 5,
      quality: "480p",
    };
  }

  /**
   * 字字动画: 多图多音频
   */
  private buildZzdhMultiImageAudio(): BuiltPrompt {
    const prompt = generateSeedanceVideoPrompt(this.panel, {
      characters: this.context.characters.map((c) => c.name).join(", "),
      location: this.context.location.name,
      props: this.context.props?.map((p) => p.name).join(", "),
      visualStyle: this.context.artStyle,
    });

    return {
      mode: "zzdh-multi-image-audio",
      template: "MiniMax H3 多图多音频",
      prompt,
      requiresReferenceImages: true,
      referenceTypes: ["character", "scene"],
      aspectRatio: "vertical",
      duration: 5,
      quality: "480p",
    };
  }

  /**
   * 字字动画: 对口型
   */
  private buildZzdhLipSync(): BuiltPrompt {
    const prompt = generateSeedanceVideoPrompt(this.panel, {
      characters: this.context.characters.map((c) => c.name).join(", "),
      location: this.context.location.name,
      props: this.context.props?.map((p) => p.name).join(", "),
      visualStyle: this.context.artStyle,
    });

    return {
      mode: "zzdh-lip-sync",
      template: "MiniMax H3 对口型",
      prompt,
      requiresReferenceImages: true,
      referenceTypes: ["character"],
      aspectRatio: "vertical",
      duration: 5,
      quality: "480p",
    };
  }

  /**
   * 方案3: 资产设计表
   */
  private buildAssetReferenceSheet(): BuiltPrompt {
    // 默认生成角色设计表
    const characterSheet = {
      type: "character" as const,
      name: this.context.characters[0]?.name || "角色",
      basic: {
        age: "20岁",
        gender: "未知",
        height: "170cm",
        bodyType: "标准",
      },
      appearance: {
        face: this.context.characters[0]?.appearance || "",
        hair: "黑色短发",
        eyes: "棕色眼睛",
        skin: "白皙",
        distinctive: [],
      },
      outfit: {
        top: this.context.characters[0]?.outfit || "",
        bottom: "长裤",
        shoes: "运动鞋",
        accessories: [],
        colorScheme: ["深蓝", "白色"],
      },
      personality: "未知",
    };

    const prompt = generateCharacterDesignSheetPrompt(
      characterSheet,
      this.context.artStyle
    );

    return {
      mode: "asset-reference-sheet",
      template: "角色设计表",
      prompt,
      requiresReferenceImages: false,
      referenceTypes: [],
      aspectRatio: "1:1", // 设计表通常是方形
    };
  }

  /**
   * 获取分镜的宽高比
   */
  private getAspectRatio(): string {
    // 根据景别和运镜智能判断宽高比
    const { shotType, cameraMovement } = this.panel.cinematography;

    // 全景/大全景通常用16:9或21:9
    if (shotType === "EWS" || shotType === "FS") {
      return "16:9";
    }

    // 竖屏特写可以用9:16
    if (shotType === "ECU" && cameraMovement === "push") {
      return "9:16";
    }

    // 默认16:9电影画幅
    return "16:9";
  }
}

// ============================================
// 批量构建工具
// ============================================

export interface BatchBuildOptions {
  mode: GenerationMode;
  panels: StoryboardPanel[];
  context: PromptBuilderContext;
  onProgress?: (index: number, total: number, result: BuiltPrompt) => void;
}

export function batchBuildPrompts(options: BatchBuildOptions): BuiltPrompt[] {
  return options.panels.map((panel, index) => {
    const builder = new StoryboardPromptBuilder(panel, options.context);
    const result = builder.build(options.mode);

    options.onProgress?.(index, options.panels.length, result);
    return result;
  });
}

// ============================================
// 快捷导出
// ============================================

export const StoryboardPromptBuilderAPI = {
  create: (panel: StoryboardPanel, context: PromptBuilderContext) =>
    new StoryboardPromptBuilder(panel, context),
  batch: batchBuildPrompts,
};

export default StoryboardPromptBuilder;
