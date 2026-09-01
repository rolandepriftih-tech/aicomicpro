/**
 * 资产分析与分镜生成相关的类型定义。
 * 这些类型同时服务于前端和后端，保证接口返回结构稳定可控。
 */

/** 角色在剧本中出现的不同视觉状态（战损、驾驶舱内、正装等） */
export interface AssetCharacterState {
  /** 状态名称，如「机甲座舱内」「战损」「晚宴礼服」 */
  stateName: string;
  /** 该状态下的完整视觉描述，需可独立指导生图 */
  description: string;
}

/** /api/analyze 返回的单个角色资产 */
export interface AssetCharacter {
  name: string;
  /** 默认/主视觉定妆描述（全身或最具代表性的一镜） */
  description: string;
  role: string; // 主角 / 配角 / 反派
  gender?: string; // 男 / 女 / 未知
  age?: string; // 如 "18岁"
  height?: string; // 如 "168cm"
  bodyType?: string; // 如 "纤细敏捷型"
  /** 剧本中明确出现的多种造型与状态，须逐条拆分，不得合并省略 */
  states?: AssetCharacterState[];
}

/** /api/analyze 返回的单个场景资产 */
export interface AssetScene {
  name: string;
  /** 须包含：内景/外景、尺度、时代或世界观、主光源、天气与氛围、标志性结构或陈设 */
  description: string;
  type?: string; // 室内/室外/太空/水下/梦境/异空间
  timeOfDay?: string; // 清晨/正午/黄昏/夜晚/黎明
  weather?: string; // 晴朗/雨天/雪天/雾天/暴风/无
}

/** 同一道具在不同剧情阶段的视觉变体（未启动/充能/破损等） */
export interface AssetPropVariant {
  variantName: string;
  description: string;
}

/** /api/analyze 返回的单个道具资产 */
export interface AssetProp {
  name: string;
  /** 主状态或默认外观的详细视觉描述 */
  description: string;
  type?: string; // 武器/饰品/工具/载具/容器/法器/科技装置
  /** 若道具有多种关键视觉形态，逐条列出 */
  variants?: AssetPropVariant[];
}

/**
 * 机舱 / 驾驶舱 / 舰桥 / 机甲座舱等封闭操控空间。
 * 与「场景」区分：侧重控制台、HUD、座椅、舷窗视野与舱内光影。
 */
export interface AssetCockpit {
  name: string;
  description: string;
  /** 关联的载具、机体或场景名（若有） */
  hostAsset?: string;
  /** 常驻操作者或乘员提示（若有） */
  occupantsHint?: string;
}

/** /api/analyze 返回的单个生物资产 */
export interface AssetCreature {
  name: string;
  description: string;
  type: string; // 宠物 / 坐骑 / 怪物BOSS / 机械生命 等
}

/** /api/analyze 当前返回的资产定妆室结构 */
export interface AnalyzeAssetsResponse {
  characters: AssetCharacter[];
  creatures: AssetCreature[];
  scenes: AssetScene[];
  props: AssetProp[];
  /** 驾驶舱、机舱、舰桥、机甲座舱等；无则空数组 */
  cockpits: AssetCockpit[];
  /** 导演总览语句 */
  directorNotes: string;
}

/** /api/generate-storyboard 返回的单条分镜面板信息 */
export interface StoryboardPanel {
  panelId: number;
  timeRange?: string;
  /** 单个分镜的时长（秒），要求在 5-15 之间 */
  duration?: number;
  /** 景别与运镜描述，例如 "Medium Shot, Slow push-in" */
  shotSizeAndCamera?: string;
  assetsUsed?: string[];
  /** 场记自检结果，检查 180 度轴线、动作衔接、服装/战损状态、光影一致性等 */
  continuityCheck?: string;
  /** 声音设计与音效提示，例如 BGM 氛围与关键 SFX */
  audioCues?: string;
  /** 面向下一镜头的转场建议，例如 Cut / Whip pan / Match cut */
  transitionToNext?: string;
  /** 给导演 / 用户看的中文画面阐述 */
  chineseDirectorNotes?: string;
  /** 给生图/渲染模型看的英文提示词，已包含画风前缀与资产映射信息 */
  englishImagePrompt?: string;
  /** 给可灵等AI视频模型用的中文视频提示词，强调镜头运动、主体动作、时间变化 */
  videoPrompt?: string;
  /** 自动匹配到的已有资产名称列表（前端根据 assetsUsed 与 analysisResult 计算） */
  matchedAssets?: string[];
  imageReferences?: Array<{
    assetName?: string;
    referenceType?: string;
    weight?: number;
  }>;
}

/** /api/generate-storyboard 返回的整体结构 */
export interface GenerateStoryboardResponse {
  meta?: {
    totalDuration?: string;
    globalEnvironment?: string;
    stylePrefix?: string;
  };
  panels?: StoryboardPanel[];
}

