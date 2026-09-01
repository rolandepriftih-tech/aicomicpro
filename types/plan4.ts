/**
 * 方案四：高质量连续分镜 —— 导演管线类型定义。
 * 导演先产出分镜 + 提示词，再为每一格指定后续实际生图时要走的「技术路线」（首尾帧 / 多参考 / 九宫格等）。
 * 当前文件仅定义契约，具体 LLM 提示词与执行器在后续迭代中补齐。
 */

/** 单格分镜建议采用的生图策略（后续会对应不同 API 参数与编排） */
export type Plan4ImageGenStrategy =
  | "single_t2i"
  | "first_last_frame"
  | "multi_reference"
  | "nine_grid";

/** 单条分镜的导演输出（分镜文案 + 提示词 + 生图策略决策） */
export interface Plan4PanelDirective {
  /** 与主分镜画廊对齐的序号 */
  panelIndex: number;
  /** 剧情节拍一句话，便于人类扫读 */
  storyBeat: string;
  /** 给团队看的中文画面说明 */
  chineseDirectorNotes: string;
  /** 给生图模型用的英文提示词（后续可按策略再拆子字段） */
  englishImagePrompt: string;
  /**
   * 本格推荐的生图方式：例如动作转场用首尾帧、群像一致性用多参考、快切蒙太奇用九宫格等。
   */
  generationStrategy: Plan4ImageGenStrategy;
  /** 导演为何选该策略的简短理由，便于调试与迭代提示词 */
  strategyRationale: string;
  /** 若为多参考或首尾帧，可点名依赖的资产名（与资产定妆室 name 对齐） */
  primaryReferenceAssets?: string[];
  /** 首尾帧链路：可选指向「上一格」或特定格，用于后续自动串联；占位 */
  continuityWithPanelIndex?: number | null;
  /** 九宫格时：3x3 每格一句占位说明，未用九宫格时可省略 */
  nineGridCellHints?: string[];
}

export interface Plan4DirectorOutlineMeta {
  /** 整条片子的连贯性说明（光影、时间线、风格锁等），后续由 LLM 生成 */
  globalContinuityNotes?: string;
  /** 画风/技术前缀建议，可与现有 storyboard meta.stylePrefix 对齐 */
  stylePrefixHint?: string;
  /** 是否为占位数据（框架阶段 API 返回 true） */
  isStub?: boolean;
}

/** POST /api/plan4/director-outline 的标准返回体 */
export interface Plan4DirectorOutlineResponse {
  meta: Plan4DirectorOutlineMeta;
  panels: Plan4PanelDirective[];
}

/** 策略枚举 → 界面展示用中文标签 */
export const PLAN4_STRATEGY_LABELS: Record<Plan4ImageGenStrategy, string> = {
  single_t2i: "单图 · 文生图",
  first_last_frame: "首尾帧 · 关键帧过渡",
  multi_reference: "多参考图 · 一致性约束",
  nine_grid: "九宫格 · 叙事拼图",
};

/* ===================== 方案四可视化画布类型 ===================== */

export type CanvasNodeType = "asset" | "panel" | "style";

export type CanvasEdgeType = "references" | "uses" | "styled_by";

/** 画布上的资产节点数据 */
export interface Plan4CanvasAssetData {
  name: string;
  description: string;
  assetType: "character" | "scene" | "prop" | "creature" | "cockpit" | "custom";
  imageUrl?: string;
  referenceImage?: string;
  isGenerating?: boolean;
  generateStatus?: "idle" | "generating" | "done" | "error";
  /** 角色一致性锁定 */
  consistencyLock?: boolean;
  /** 一致性描述文本（自动提取或手动编辑） */
  consistencyPrompt?: string;
}

/** 画布上的分镜节点数据 */
export interface Plan4CanvasPanelData {
  panelId: number;
  storyBeat: string;
  englishImagePrompt: string;
  chineseDirectorNotes?: string;
  imageUrl?: string;
  isGenerating?: boolean;
  generateStatus?: "idle" | "generating" | "done" | "error";
  /** 该分镜绑定的画风（由 style 节点覆盖） */
  style?: string;
  /** 画幅比例 */
  aspectRatio?: string;
}

/** 画布上的风格节点数据 */
export interface Plan4CanvasStyleData {
  name: string;
  styleValue: string; // 对应 STYLE_CONFIGS 的 key
  customPrefix?: string; // 可选覆盖
}

/** 画布节点 */
export interface Plan4CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: Plan4CanvasAssetData | Plan4CanvasPanelData | Plan4CanvasStyleData;
  width?: number;
  height?: number;
}

/** 画布边 */
export interface Plan4CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: CanvasEdgeType;
  label?: string;
}

/** 画布完整状态 */
export interface Plan4CanvasState {
  nodes: Plan4CanvasNode[];
  edges: Plan4CanvasEdge[];
}
