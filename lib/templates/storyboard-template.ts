/**
 * 电影分镜图模板系统
 * 基于 seedance-director 技能包
 *
 * 支持两种生成方案:
 * 1. 分镜图 (Storyboard Image) - 用于GPT Image 2生成静态分镜
 * 2. 视频提示词 (Video Prompt) - 用于Seedance生成视频
 */

import type { FrameState } from "@/components/plan4-canvas/director-elements";

// ============================================
// 类型定义
// ============================================

export type ShotType = "ECU" | "CU" | "MCU" | "MS" | "FS" | "EWS";
export type CameraHeight = "worm" | "low" | "eye" | "high" | "overhead";
export type DepthOfField = "shallow" | "medium" | "deep";
export type Composition =
  | "rule_of_thirds"
  | "center"
  | "symmetry"
  | "leading_lines"
  | "frame_in_frame"
  | "golden_ratio";
export type CameraMovement =
  | "static"
  | "push"
  | "pull"
  | "pan"
  | "tilt"
  | "orbit"
  | "tracking"
  | "handheld"
  | "crane"
  | "zoom";
export type ActionRhythm =
  | "slow_压迫"
  | "explosive_加速"
  | "mechanical_pause"
  | "floating"
  | "nervous_twitch";

export interface CinematographyConfig {
  shotType: ShotType;
  focalLength: number;
  cameraHeight: CameraHeight;
  depthOfField: DepthOfField;
  composition: Composition;
  cameraMovement: CameraMovement;
  actionRhythm: ActionRhythm;
  directorStyle?: string;
  lighting?: {
    keyLight: string;
    colorTemperature: string;
    mood: string;
  };
  materialKeywords?: string[];
}

export interface StoryboardPanel {
  panelId: number;
  storyBeat: string;
  englishImagePrompt: string;
  chineseDirectorNotes: string;
  cinematography: CinematographyConfig;
  firstFrame?: FrameState;
  lastFrame?: FrameState;
  characters?: string[];
  location?: string;
  props?: string[];
}

export type GenerationMode =
  | "gpt-image2-storyboard" // 方案1: GPT Image 2 生成分镜图
  | "seedance-text-to-video" // 方案2: Seedance 文生视频
  | "seedance-image-to-video" // 方案2: Seedance 图生视频
  | "zzdh-text-to-video" // 字字动画: 文生视频
  | "zzdh-first-last-frame" // 字字动画: 首尾帧
  | "zzdh-multi-reference" // 字字动画: 多参考图生
  | "zzdh-multi-image-audio" // 字字动画: 多图多音频
  | "zzdh-lip-sync" // 字字动画: 对口型
  | "asset-reference-sheet"; // 角色/场景设计表

// ============================================
// 1. 分镜图模板 (GPT Image 2)
// ============================================

export interface StoryboardImageTemplate {
  layout: "horizontal" | "vertical" | "grid";
  panels: {
    id: number;
    shotType: ShotType;
    focalLength: number;
    composition: Composition;
    cameraMovement: CameraMovement;
    description: string;
    visualNotes: string[];
  }[];
}

/**
 * 生成分镜图提示词 (GPT Image 2)
 * 6模块合一的视觉参考板
 */
export function generateStoryboardImagePrompt(
  panel: StoryboardPanel,
  options: {
    artStyle: string;
    characters: { name: string; appearance: string; outfit: string }[];
    location: string;
    mood: string;
    references?: string[];
  }
): string {
  const parts: string[] = [];

  // Layer 1: 基础画风设定
  parts.push(`[画风设定] ${options.artStyle}`);
  parts.push(`构图: ${panel.cinematography.composition}`);
  parts.push(`景别: ${panel.cinematography.shotType}`);
  parts.push(`焦段: ${panel.cinematography.focalLength}mm`);

  // Layer 2: 角色资产
  if (options.characters.length > 0) {
    parts.push("\n[角色]");
    options.characters.forEach((char, i) => {
      parts.push(`角色${i + 1} (${char.name}): ${char.appearance}, 穿着${char.outfit}`);
    });
  }

  // Layer 3: 场景叙事
  parts.push(`\n[场景] ${options.location}`);
  parts.push(`氛围: ${options.mood}`);
  parts.push(`动作: ${panel.storyBeat}`);

  // Layer 4: 分镜编排
  parts.push(`\n[运镜] ${panel.cinematography.cameraMovement}`);
  parts.push(`机位: ${panel.cinematography.cameraHeight}`);
  parts.push(`景深: ${panel.cinematography.depthOfField}`);

  if (panel.cinematography.directorStyle) {
    parts.push(`\n[导演风格] ${panel.cinematography.directorStyle}`);
  }

  if (panel.cinematography.materialKeywords?.length) {
    parts.push(`\n[材质] ${panel.cinematography.materialKeywords.join(", ")}`);
  }

  // 首尾帧
  if (panel.firstFrame) {
    parts.push(`\n[首帧状态]`);
    parts.push(`  位置: ${panel.firstFrame.characterPosition}`);
    parts.push(`  姿态: ${panel.firstFrame.characterPosture}`);
    parts.push(`  朝向: ${panel.firstFrame.characterOrientation}`);
  }

  if (panel.lastFrame) {
    parts.push(`\n[尾帧状态]`);
    parts.push(`  位置: ${panel.lastFrame.characterPosition}`);
    parts.push(`  姿态: ${panel.lastFrame.characterPosture}`);
    parts.push(`  朝向: ${panel.lastFrame.characterOrientation}`);
  }

  parts.push(`\n[生图提示词] ${panel.englishImagePrompt}`);

  return parts.join("\n");
}

// ============================================
// 2. 场景预制作参考板模板
// ============================================

export interface SceneReferenceTemplate {
  sceneOverview: {
    name: string;
    time: string;
    weather: string;
    location: string;
  };
  visualDNA: {
    colorPalette: string[];
    lightingStyle: string;
    textureStyle: string;
  };
  keyShots: {
    id: number;
    angle: string;
    composition: string;
    action: string;
  }[];
  characterPositions: {
    character: string;
    position: string;
    movement: string;
  }[];
  props: {
    name: string;
    material: string;
    position: string;
  }[];
  lighting: {
    key: string;
    fill: string;
    ambient: string;
  };
}

/**
 * 生成场景预制作参考板提示词 (6模块)
 */
export function generateSceneReferencePrompt(
  template: SceneReferenceTemplate,
  artStyle: string
): string {
  const parts: string[] = [];

  // A. 场景概览
  parts.push(`[A. 场景概览] ${template.sceneOverview.name}`);
  parts.push(`时间: ${template.sceneOverview.time}`);
  parts.push(`天气: ${template.sceneOverview.weather}`);
  parts.push(`地点: ${template.sceneOverview.location}`);

  // B. 视觉DNA
  parts.push(`\n[B. 视觉DNA]`);
  parts.push(`配色: ${template.visualDNA.colorPalette.join(", ")}`);
  parts.push(`光影: ${template.visualDNA.lightingStyle}`);
  parts.push(`材质: ${template.visualDNA.textureStyle}`);

  // C. 关键分镜
  parts.push(`\n[C. 关键分镜]`);
  template.keyShots.forEach((shot) => {
    parts.push(`  #${shot.id}: [${shot.angle}] ${shot.composition} - ${shot.action}`);
  });

  // D. 角色站位
  parts.push(`\n[D. 角色站位]`);
  template.characterPositions.forEach((pos) => {
    parts.push(`  ${pos.character}: ${pos.position} (${pos.movement})`);
  });

  // E. 道具
  parts.push(`\n[E. 道具/细节]`);
  template.props.forEach((prop) => {
    parts.push(`  ${prop.name}: ${prop.material} @ ${prop.position}`);
  });

  // F. 光影参考
  parts.push(`\n[F. 光影参考]`);
  parts.push(`主光: ${template.lighting.key}`);
  parts.push(`辅光: ${template.lighting.fill}`);
  parts.push(`环境: ${template.lighting.ambient}`);

  parts.push(`\n[画风] ${artStyle}`);

  return parts.join("\n");
}

// ============================================
// 3. 资产设计表模板 (角色/场景/道具)
// ============================================

export type DesignSheetType = "character" | "scene" | "prop" | "collection";

export interface CharacterDesignSheet {
  type: "character";
  name: string;
  basic: {
    age: string;
    gender: string;
    height: string;
    bodyType: string;
  };
  appearance: {
    face: string;
    hair: string;
    eyes: string;
    skin: string;
    distinctive: string[];
  };
  outfit: {
    top: string;
    bottom: string;
    shoes: string;
    accessories: string[];
    colorScheme: string[];
  };
  personality: string;
  referenceImages?: string[];
}

export interface SceneDesignSheet {
  type: "scene";
  name: string;
  basic: {
    location: string;
    time: string;
    weather: string;
    atmosphere: string;
  };
  layout: {
    topView: string;
    perspective: string;
    keyElements: string[];
  };
  visual: {
    colorPalette: string[];
    lighting: string;
    textures: string[];
  };
}

export interface PropDesignSheet {
  type: "prop";
  name: string;
  category: string;
  appearance: {
    shape: string;
    material: string;
    color: string;
    texture: string;
    size: string;
  };
  function: string;
  storyImportance: string;
}

export type DesignSheet = CharacterDesignSheet | SceneDesignSheet | PropDesignSheet;

/**
 * 生成角色设计表提示词
 */
export function generateCharacterDesignSheetPrompt(
  sheet: CharacterDesignSheet,
  artStyle: string
): string {
  const parts: string[] = [];

  parts.push(`[角色设计表] ${sheet.name}`);
  parts.push(`\n[基本信息]`);
  parts.push(`年龄: ${sheet.basic.age}`);
  parts.push(`性别: ${sheet.basic.gender}`);
  parts.push(`身高: ${sheet.basic.height}`);
  parts.push(`体型: ${sheet.basic.bodyType}`);

  parts.push(`\n[外貌特征]`);
  parts.push(`脸型: ${sheet.appearance.face}`);
  parts.push(`发型: ${sheet.appearance.hair}`);
  parts.push(`眼睛: ${sheet.appearance.eyes}`);
  parts.push(`肤色: ${sheet.appearance.skin}`);
  parts.push(`特征: ${sheet.appearance.distinctive.join(", ")}`);

  parts.push(`\n[服装设定]`);
  parts.push(`上身: ${sheet.outfit.top}`);
  parts.push(`下身: ${sheet.outfit.bottom}`);
  parts.push(`鞋履: ${sheet.outfit.shoes}`);
  parts.push(`配饰: ${sheet.outfit.accessories.join(", ")}`);
  parts.push(`配色: ${sheet.outfit.colorScheme.join(", ")}`);

  parts.push(`\n[性格] ${sheet.personality}`);
  parts.push(`\n[画风] ${artStyle}`);

  parts.push(`\n[输出要求]`);
  parts.push("1. 正面全身像 (Front Full Body)");
  parts.push("2. 侧面全身像 (Side Full Body)");
  parts.push("3. 背面全身像 (Back Full Body)");
  parts.push("4. 头部特写 - 表情表 (6种表情)");
  parts.push("5. 手部细节");
  parts.push("6. 服装材质特写");

  return parts.join("\n");
}

/**
 * 生成场景设计表提示词
 */
export function generateSceneDesignSheetPrompt(
  sheet: SceneDesignSheet,
  artStyle: string
): string {
  const parts: string[] = [];

  parts.push(`[场景设计表] ${sheet.name}`);

  parts.push(`\n[基本信息]`);
  parts.push(`地点: ${sheet.basic.location}`);
  parts.push(`时间: ${sheet.basic.time}`);
  parts.push(`天气: ${sheet.basic.weather}`);
  parts.push(`氛围: ${sheet.basic.atmosphere}`);

  parts.push(`\n[布局设计]`);
  parts.push(`俯视布局: ${sheet.layout.topView}`);
  parts.push(`透视视角: ${sheet.layout.perspective}`);
  parts.push(`关键元素: ${sheet.layout.keyElements.join(", ")}`);

  parts.push(`\n[视觉设定]`);
  parts.push(`配色: ${sheet.visual.colorPalette.join(", ")}`);
  parts.push(`光影: ${sheet.visual.lighting}`);
  parts.push(`材质: ${sheet.visual.textures.join(", ")}`);

  parts.push(`\n[画风] ${artStyle}`);

  parts.push(`\n[输出要求]`);
  parts.push("1. 俯视布局图 (Top View)");
  parts.push("2. 主透视图 (Main Perspective)");
  parts.push("3. 关键角度特写 (Key Angles)");
  parts.push("4. 光影氛围图 (Lighting Mood)");
  parts.push("5. 材质参考 (Texture Reference)");

  return parts.join("\n");
}

/**
 * 生成道具设计表提示词
 */
export function generatePropDesignSheetPrompt(
  sheet: PropDesignSheet,
  artStyle: string
): string {
  const parts: string[] = [];

  parts.push(`[道具设计表] ${sheet.name}`);
  parts.push(`类型: ${sheet.category}`);

  parts.push(`\n[外观特征]`);
  parts.push(`形状: ${sheet.appearance.shape}`);
  parts.push(`材质: ${sheet.appearance.material}`);
  parts.push(`颜色: ${sheet.appearance.color}`);
  parts.push(`纹理: ${sheet.appearance.texture}`);
  parts.push(`尺寸: ${sheet.appearance.size}`);

  parts.push(`\n[功能] ${sheet.function}`);
  parts.push(`剧情重要性: ${sheet.storyImportance}`);

  parts.push(`\n[画风] ${artStyle}`);

  parts.push(`\n[输出要求]`);
  parts.push("1. 正视图 (Front)");
  parts.push("2. 侧视图 (Side)");
  parts.push("3. 俯视图 (Top)");
  parts.push("4. 细节特写 (Detail Shot)");
  parts.push("5. 使用场景示意 (Usage Context)");

  return parts.join("\n");
}

// ============================================
// 4. Seedance 视频提示词模板
// ============================================

export interface SeedanceVideoPrompt {
  cinematography: string;
  action: string;
  subject: string;
  environment: string;
  lighting: string;
  camera: string;
  duration: number;
  frameInfo?: {
    first: FrameState;
    last: FrameState;
  };
}

/**
 * 生成Seedance视频提示词
 */
export function generateSeedanceVideoPrompt(
  panel: StoryboardPanel,
  options: {
    characters: string;
    location: string;
    props?: string;
    visualStyle: string;
  }
): string {
  const parts: string[] = [];

  // 导演描述 (Director's Description)
  parts.push(`Cinematic ${panel.cinematography.shotType} shot`);
  parts.push(`${panel.cinematography.focalLength}mm lens`);
  parts.push(`${panel.cinematography.cameraHeight} angle`);
  parts.push(`${panel.cinematography.depthOfField} depth of field`);

  // 主体动作
  parts.push(`\n${panel.storyBeat}`);
  parts.push(`Featuring: ${options.characters}`);

  // 环境
  parts.push(`\nEnvironment: ${options.location}`);
  if (options.props) {
    parts.push(`Props: ${options.props}`);
  }

  // 运镜
  parts.push(`\nCamera: ${panel.cinematography.cameraMovement}`);
  if (panel.cinematography.directorStyle) {
    parts.push(`Style: ${panel.cinematography.directorStyle} cinematic style`);
  }

  // 光影
  if (panel.cinematography.lighting) {
    parts.push(`Lighting: ${panel.cinematography.lighting.keyLight} key light`);
    parts.push(`Mood: ${panel.cinematography.lighting.mood}`);
  }

  // 材质
  if (panel.cinematography.materialKeywords?.length) {
    parts.push(`Textures: ${panel.cinematography.materialKeywords.join(", ")}`);
  }

  // 视觉风格
  parts.push(`\n${options.visualStyle}`);

  return parts.join(", ");
}

// ============================================
// 5. 模板匹配器
// ============================================

export interface TemplateMatchResult {
  mode: GenerationMode;
  template: string;
  requiresReferenceImages: boolean;
  referenceTypes?: ("character" | "scene" | "style")[];
  promptBuilder: () => string;
}

/**
 * 根据生图模式匹配对应模板
 */
export function matchTemplateForMode(
  mode: GenerationMode,
  panel: StoryboardPanel,
  context: {
    characters: { name: string; appearance: string; outfit: string }[];
    location: string;
    props?: string[];
    artStyle: string;
    references?: string[];
  }
): TemplateMatchResult {
  switch (mode) {
    case "gpt-image2-storyboard":
      return {
        mode,
        template: "6模块分镜图",
        requiresReferenceImages: false,
        promptBuilder: () =>
          generateStoryboardImagePrompt(panel, {
            artStyle: context.artStyle,
            characters: context.characters.map((c) => ({
              name: c.name,
              appearance: c.appearance,
              outfit: c.outfit,
            })),
            location: context.location,
            mood: panel.chineseDirectorNotes,
            references: context.references,
          }),
      };

    case "seedance-text-to-video":
      return {
        mode,
        template: "Seedance文生视频",
        requiresReferenceImages: false,
        promptBuilder: () =>
          generateSeedanceVideoPrompt(panel, {
            characters: context.characters.map((c) => c.name).join(", "),
            location: context.location,
            props: context.props?.join(", "),
            visualStyle: context.artStyle,
          }),
      };

    case "seedance-image-to-video":
      return {
        mode,
        template: "Seedance图生视频",
        requiresReferenceImages: true,
        referenceTypes: ["character", "scene"],
        promptBuilder: () =>
          generateSeedanceVideoPrompt(panel, {
            characters: context.characters.map((c) => c.name).join(", "),
            location: context.location,
            props: context.props?.join(", "),
            visualStyle: context.artStyle,
          }),
      };

    case "asset-reference-sheet":
      // 返回默认的角色设计表
      return {
        mode,
        template: "资产设计表",
        requiresReferenceImages: false,
        promptBuilder: () =>
          generateCharacterDesignSheetPrompt(
            {
              type: "character",
              name: context.characters[0]?.name || "角色",
              basic: {
                age: "20岁",
                gender: "未知",
                height: "170cm",
                bodyType: "标准",
              },
              appearance: {
                face: context.characters[0]?.appearance || "",
                hair: "黑色短发",
                eyes: "棕色眼睛",
                skin: "白皙",
                distinctive: [],
              },
              outfit: {
                top: context.characters[0]?.outfit || "",
                bottom: "长裤",
                shoes: "运动鞋",
                accessories: [],
                colorScheme: ["深蓝", "白色"],
              },
              personality: "未知",
            },
            context.artStyle
          ),
      };

    default:
      throw new Error(`未知的生图模式: ${mode}`);
  }
}

// ============================================
// 6. 批量生成工具
// ============================================

export interface BatchGenerateOptions {
  mode: GenerationMode;
  panels: StoryboardPanel[];
  context: {
    characters: { name: string; appearance: string; outfit: string }[];
    locations: Record<string, string>;
    props?: Record<string, string[]>;
    artStyle: string;
  };
  onProgress?: (index: number, total: number, result: TemplateMatchResult) => void;
}

export function batchGeneratePrompts(
  options: BatchGenerateOptions
): TemplateMatchResult[] {
  return options.panels.map((panel, index) => {
    const result = matchTemplateForMode(options.mode, panel, {
      characters: options.context.characters,
      location: options.context.locations[panel.location || "default"] || "未知场景",
      props: options.context.props?.[panel.panelId],
      artStyle: options.context.artStyle,
    });

    options.onProgress?.(index, options.panels.length, result);
    return result;
  });
}

// ============================================
// 7. 工具函数
// ============================================

/**
 * 获取导演技巧描述
 */
export function getDirectorTechniqueDescription(directorId: string): string {
  const descriptions: Record<string, string> = {
    zhang_yimou: "色彩象征、对称构图、大场面 - 如《英雄》《影》",
    wong_kar_wai: "慢镜头抽帧、霓虹色彩、情绪化运镜 - 如《重庆森林》《花样年华》",
    nolan: "时间操控、IMAX大全景、交叉剪辑 - 如《盗梦空间》《星际穿越》",
    villeneuve: "极简构图、留白、慢节奏、巨物 - 如《降临》《沙丘》",
    spielberg: "长镜头、光影运用、情感渲染 - 如《辛德勒的名单》《E.T.》",
    kubrick: "对称构图、单点透视、冷峻风格 - 如《2001太空漫游》《闪灵》",
  };

  return descriptions[directorId] || "";
}

/**
 * 获取宽高比建议
 */
export function getAspectRatioRecommendation(shotType: ShotType): string {
  const recommendations: Record<ShotType, string> = {
    ECU: "9:16 (竖屏特写)",
    CU: "4:5 或 1:1 (头像)",
    MCU: "16:9 (标准电影)",
    MS: "16:9 (标准电影)",
    FS: "21:9 (宽银幕)",
    EWS: "21:9 或 32:9 (超宽银幕)",
  };

  return recommendations[shotType] || "16:9";
}

// ============================================
// 默认导出
// ============================================

export const StoryboardTemplates = {
  // 分镜图
  storyboardImage: generateStoryboardImagePrompt,

  // 场景参考板
  sceneReference: generateSceneReferencePrompt,

  // 设计表
  characterSheet: generateCharacterDesignSheetPrompt,
  sceneSheet: generateSceneDesignSheetPrompt,
  propSheet: generatePropDesignSheetPrompt,

  // 视频提示词
  seedanceVideo: generateSeedanceVideoPrompt,

  // 模板匹配
  matchForMode: matchTemplateForMode,
  batchGenerate: batchGeneratePrompts,

  // 工具函数
  getDirectorTechniqueDescription,
  getAspectRatioRecommendation,
};

export default StoryboardTemplates;
