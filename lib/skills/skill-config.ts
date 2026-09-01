import type { GenerationMode } from "@/lib/templates/storyboard-template";

export type SkillCategory = "character" | "cinematic" | "commercial" | "creative" | "utility";
export type SkillDifficulty = "beginner" | "intermediate" | "advanced";

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  mode: GenerationMode;
  defaultOptions: {
    duration?: number;
    aspectRatio?: string;
    quality?: string;
    generateAudio?: boolean;
    watermark?: boolean;
  };
  provider?: "ark" | "zizidonghua";
  model?: string;
  promptPrefix?: string;
  promptSuffix?: string;
  recommendedFor: string[];
  difficulty: SkillDifficulty;
  tags: string[];
  requiresRefImages: boolean;
  refImageTypes?: ("character" | "scene" | "style")[];
}

export const SKILL_CONFIGS: Record<string, SkillConfig> = {
  // ========== Seedance 系列 ==========
  "movie-trailer": {
    id: "movie-trailer",
    name: "电影预告片",
    description: "生成电影级别的预告片片段，宏大场景+戏剧性运镜",
    icon: "Clapperboard",
    category: "cinematic",
    mode: "seedance-text-to-video",
    defaultOptions: { duration: 10, aspectRatio: "21:9", quality: "1080p", generateAudio: true },
    promptPrefix: "Cinematic movie trailer style, epic scale, dramatic lighting, anamorphic lens flare, ",
    promptSuffix: ", film grain, color graded, 24fps cinematic motion",
    recommendedFor: ["电影预览", "概念验证", "视觉冲击"],
    difficulty: "beginner",
    tags: ["电影", "预告片", "史诗", "宏大"],
    requiresRefImages: false,
  },
  "character-animation": {
    id: "character-animation",
    name: "角色动画",
    description: "基于角色参考图生成自然流畅的角色动作视频",
    icon: "User",
    category: "character",
    mode: "seedance-image-to-video",
    defaultOptions: { duration: 5, aspectRatio: "16:9", quality: "720p", generateAudio: true },
    promptPrefix: "Natural character animation, smooth body movement, ",
    recommendedFor: ["角色表演", "动作展示", "人物动态"],
    difficulty: "beginner",
    tags: ["角色", "动画", "动作", "表演"],
    requiresRefImages: true,
    refImageTypes: ["character"],
  },
  "scene-atmosphere": {
    id: "scene-atmosphere",
    name: "场景氛围",
    description: "生成场景环境的氛围视频，适合空镜和转场",
    icon: "Mountain",
    category: "cinematic",
    mode: "seedance-text-to-video",
    defaultOptions: { duration: 8, aspectRatio: "16:9", quality: "720p", generateAudio: true },
    promptPrefix: "Atmospheric scene establishing shot, environmental ambience, ",
    promptSuffix: ", subtle environmental motion, natural lighting shifts",
    recommendedFor: ["空镜头", "转场", "环境设定"],
    difficulty: "beginner",
    tags: ["场景", "氛围", "空镜", "环境"],
    requiresRefImages: false,
  },

  // ========== MiniMax H3 系列 ==========
  "micro-expression": {
    id: "micro-expression",
    name: "微表情视频",
    description: "捕捉角色细微表情变化，眼神、嘴角的微妙动态",
    icon: "Smile",
    category: "character",
    mode: "zzdh-first-last-frame",
    defaultOptions: { duration: 3, aspectRatio: "vertical", quality: "480p" },
    provider: "zizidonghua",
    promptPrefix: "Subtle micro-expressions, delicate facial movements, nuanced emotional shifts, ",
    promptSuffix: ", close-up face detail, smooth temporal transitions",
    recommendedFor: ["表情动画", "角色特写", "情感表达"],
    difficulty: "intermediate",
    tags: ["微表情", "表情", "特写", "情感"],
    requiresRefImages: true,
    refImageTypes: ["character"],
  },
  "character-dialogue": {
    id: "character-dialogue",
    name: "角色对话",
    description: "多图+音频生成对话场景，口型和节奏跟随语音",
    icon: "MessageSquare",
    category: "character",
    mode: "zzdh-multi-image-audio",
    defaultOptions: { duration: 5, aspectRatio: "vertical", quality: "480p" },
    provider: "zizidonghua",
    promptPrefix: "Character dialogue scene, lip sync with audio, natural conversation rhythm, ",
    recommendedFor: ["对话场景", "配音视频", "剧情片段"],
    difficulty: "intermediate",
    tags: ["对话", "配音", "口型", "剧情"],
    requiresRefImages: true,
    refImageTypes: ["character"],
  },
  "lip-sync-singing": {
    id: "lip-sync-singing",
    name: "对口型唱歌",
    description: "1图+1音频，精确口型同步，适合音乐视频",
    icon: "Music",
    category: "creative",
    mode: "zzdh-lip-sync",
    defaultOptions: { duration: 5, aspectRatio: "vertical", quality: "480p" },
    provider: "zizidonghua",
    promptPrefix: "Lip sync performance, precise mouth movement matching audio, ",
    recommendedFor: ["音乐视频", "唱歌", "口型动画"],
    difficulty: "beginner",
    tags: ["唱歌", "口型", "音乐", "表演"],
    requiresRefImages: true,
    refImageTypes: ["character"],
  },
  "multi-angle-showcase": {
    id: "multi-angle-showcase",
    name: "多角度展示",
    description: "多张参考图展示角色/产品的多个角度",
    icon: "RotateCcw",
    category: "commercial",
    mode: "zzdh-multi-reference",
    defaultOptions: { duration: 5, aspectRatio: "vertical", quality: "480p" },
    provider: "zizidonghua",
    promptPrefix: "Multi-angle showcase, consistent character/product across views, ",
    promptSuffix: ", smooth camera rotation, maintaining visual consistency",
    recommendedFor: ["产品展示", "角色多角度", "360度展示"],
    difficulty: "intermediate",
    tags: ["多角度", "展示", "产品", "360度"],
    requiresRefImages: true,
    refImageTypes: ["character", "scene"],
  },
  "quick-preview": {
    id: "quick-preview",
    name: "快速预览",
    description: "最低成本快速预览视频效果，480p 极速生成",
    icon: "Zap",
    category: "utility",
    mode: "zzdh-text-to-video",
    defaultOptions: { duration: 3, aspectRatio: "vertical", quality: "480p" },
    provider: "zizidonghua",
    promptPrefix: "",
    recommendedFor: ["快速原型", "效果预览", "低成本测试"],
    difficulty: "beginner",
    tags: ["快速", "预览", "测试", "低成本"],
    requiresRefImages: false,
  },

  // ========== 图片系列 ==========
  "storyboard-sheet": {
    id: "storyboard-sheet",
    name: "分镜图",
    description: "生成6模块合一的专业分镜视觉参考板",
    icon: "Film",
    category: "cinematic",
    mode: "gpt-image2-storyboard",
    defaultOptions: {},
    promptPrefix: "",
    recommendedFor: ["分镜预览", "场景设定", "视觉参考板"],
    difficulty: "beginner",
    tags: ["分镜", "故事板", "视觉参考"],
    requiresRefImages: false,
  },
  "character-design-sheet": {
    id: "character-design-sheet",
    name: "角色设计表",
    description: "生成角色的完整设计参考表（三视图+表情+服装）",
    icon: "Grid3X3",
    category: "character",
    mode: "asset-reference-sheet",
    defaultOptions: {},
    promptPrefix: "",
    recommendedFor: ["角色设计", "人设参考", "一致性资产"],
    difficulty: "beginner",
    tags: ["角色", "设计表", "三视图", "人设"],
    requiresRefImages: false,
  },
  "scene-design-sheet": {
    id: "scene-design-sheet",
    name: "场景设计表",
    description: "生成场景的多角度设计参考图",
    icon: "LayoutGrid",
    category: "cinematic",
    mode: "asset-reference-sheet",
    defaultOptions: {},
    promptPrefix: "",
    recommendedFor: ["场景设定", "环境参考", "世界观构建"],
    difficulty: "beginner",
    tags: ["场景", "设计表", "环境", "世界观"],
    requiresRefImages: false,
  },
};

export const SKILL_LIST = Object.values(SKILL_CONFIGS);
export const SKILL_VALUES = Object.keys(SKILL_CONFIGS);

export const SKILL_CATEGORIES: Array<{ value: SkillCategory; label: string }> = [
  { value: "character", label: "角色" },
  { value: "cinematic", label: "电影" },
  { value: "commercial", label: "商业" },
  { value: "creative", label: "创意" },
  { value: "utility", label: "工具" },
];
