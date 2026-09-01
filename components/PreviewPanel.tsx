"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Clapperboard,
  User,
  MapPin,
  Package,
  Rabbit,
  Copy,
  Check,
  Settings,
  Play,
  Loader2,
  LayoutGrid,
  Mic,
  Target,
  ArrowRight,
} from "lucide-react";
import VoicePanel from "@/components/VoicePanel";
import { AssetCard } from "@/components/preview/AssetCard";
import type {
  AnalyzeAssetsResponse,
  GenerateStoryboardResponse,
  StoryboardPanel,
} from "@/types/analyze";
import type { Plan4CanvasState } from "@/types/plan4";
import type {
  ImageAssetType,
  ImageReferenceMeta,
  ImageTaskType,
} from "@/lib/image-generation-types";
import { matchAssets, extractAllAssetNames } from "@/lib/asset-matcher";
import { Plan4Canvas } from "@/components/plan4-canvas";

interface PreviewPanelProps {
  isAnalyzing?: boolean;
  data: AnalyzeAssetsResponse | null;
  currentView?: "assets" | "storyboard" | "plan4" | "voice";
  onViewChange?: (view: "assets" | "storyboard" | "plan4" | "voice") => void;
  storyboardResult?: GenerateStoryboardResponse | null;
  assetImageUrls?: Record<string, string>;
  /** 资产参考图 base64 映射（按资产名存储） */
  assetReferenceImages?: Record<string, string>;
  onGenerateImage?: (assetName: string, prompt: string, referenceImage?: string) => void;
  generatingAssetName?: string | null;
  generateImageError?: string | null;
  /** Copilot 修改分镜：传入原始 panel 与用户指令 */
  onModifyPanel?: (panel: StoryboardPanel, instruction: string) => Promise<void>;
  /** 当前分镜画幅比例：统一控制画廊左侧占位容器的宽高比 */
  aspectRatio?: string;
  /** 资产描述在资产定妆室中的本地修改映射（按资产名存储） */
  assetDescOverrides?: Record<string, string>;
  /** 当用户在资产定妆室中编辑描述时回调，向上同步最新文案 */
  onAssetDescriptionChange?: (assetName: string, description: string) => void;
  /** 当用户上传资产参考图时回调 */
  onAssetReferenceImageChange?: (assetName: string, referenceImage: string | null) => void;
  /** 分镜参考图持久化回调（透传给 Plan4Canvas） */
  onPanelReferenceImageChange?: (panelId: string, image: string | null) => void;
  /** 分镜参考图（透传给 Plan4Canvas，刷新恢复用） */
  panelReferenceImages?: Record<string, string>;
  /** Copilot 改写资产描述：传入资产名与用户指令，返回改写后的描述 */
  onRefineAsset?: (assetName: string, instruction: string) => Promise<string>;
  /** 分镜 panel 已生成的图片（按 panelId 存储） */
  panelImageUrls?: Record<string, string>;
  /** 批量生图：传入 panel 列表、并发数、进度回调、取消信号 */
  onBatchGenerateImages?: (
    panels: StoryboardPanel[],
    concurrency?: number,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ) => Promise<void>;
  /** 完整的资产分析结果（用于分镜自动匹配资产） */
  analysisResult?: AnalyzeAssetsResponse | null;
  /** 分镜 panel 生图状态 */
  panelGenerationStatus?: Record<string, "pending" | "generating" | "done" | "error">;
  /** 编辑分镜 videoPrompt */
  onVideoPromptChange?: (panelId: number, videoPrompt: string) => void;
  /** 取消批量生图 */
  onCancelBatch?: () => void;
  /** 语音合成 API Key */
  voiceApiKey?: string;
  /** 语音生成完成回调 */
  onVoiceGenerated?: (panelId: string, audioUrl: string) => void;
  /** TTS 音频共享（base64 格式） */
  voiceAudioUrls?: Record<string, string>;
  /** 多引擎 API Key */
  videoApiKeys?: Record<string, string>;
  /** 兜底索引签名，避免前后端演进导致的临时类型不匹配 */
  [key: string]: any;
}

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const text = value?.trim() ?? "";

  const handleCopy = () => {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300 shadow-inner">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        <span className="text-xs">{copied ? "已复制" : "一键复制"}</span>
      </button>
      <p className="pr-24 break-words">{text || "—"}</p>
    </div>
  );
}

/** 资产类型配置 */
const ASSET_TYPE_CONFIG = [
  { key: "characters", label: "角色", icon: User, color: "violet" },
  { key: "creatures", label: "生物", icon: Rabbit, color: "pink" },
  { key: "scenes", label: "场景", icon: MapPin, color: "sky" },
  { key: "props", label: "道具", icon: Package, color: "amber" },
  { key: "cockpits", label: "座舱", icon: Settings, color: "emerald" },
] as const;

/**
 * 定妆进度指示器：
 * 展示各类资产的定妆完成情况（有参考图或已生成图片 = 已定妆）。
 */
function AssetProgress({
  data,
  assetImageUrls,
  assetReferenceImages,
}: {
  data: AnalyzeAssetsResponse;
  assetImageUrls: Record<string, string>;
  assetReferenceImages?: Record<string, string>;
}) {
  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    const byType: {
      key: string;
      label: string;
      icon: typeof User;
      color: string;
      items: { name: string; done: boolean }[];
    }[] = [];

    for (const cfg of ASSET_TYPE_CONFIG) {
      const items = (data as any)[cfg.key] as { name: string }[] | undefined;
      if (!items?.length) continue;
      const mapped = items.map((a) => {
        const hasImage = !!assetImageUrls[a.name];
        const hasRef = !!assetReferenceImages?.[a.name];
        return { name: a.name, done: hasImage || hasRef };
      });
      total += mapped.length;
      done += mapped.filter((m) => m.done).length;
      byType.push({ ...cfg, items: mapped });
    }

    return { total, done, byType, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [data, assetImageUrls, assetReferenceImages]);

  if (stats.total === 0) return null;

  const isComplete = stats.done === stats.total;
  const barColor = isComplete ? "bg-emerald-500" : "bg-amber-500";
  const textColor = isComplete ? "text-emerald-400" : "text-amber-400";

  return (
    <div className="mb-6 rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">定妆进度</span>
        </div>
        <span className={`text-sm font-bold ${textColor}`}>
          {stats.done}/{stats.total}
        </span>
      </div>
      {/* 进度条 */}
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${stats.percent}%` }}
        />
      </div>
      {/* 分类圆点 */}
      <div className="flex flex-wrap gap-3">
        {stats.byType.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.key} className="flex items-center gap-1.5">
              <Icon className="size-3 text-zinc-500" />
              <span className="text-[11px] text-zinc-500">{group.label}</span>
              <div className="flex gap-0.5">
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    title={`${item.name}${item.done ? " ✓" : ""}`}
                    className={`size-2 rounded-full transition-colors ${
                      item.done
                        ? "bg-emerald-500"
                        : "bg-zinc-700 ring-1 ring-zinc-600/50"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* 底部提示 */}
      {!isComplete && (
        <p className="mt-2 text-[11px] text-amber-500/80">
          建议完成所有资产定妆后再生成分镜，以确保角色外观一致性。
        </p>
      )}
    </div>
  );
}

function StoryboardPanelCard({
  panel,
  onModifyPanel,
  aspectRatio,
  onGenerateImage,
  panelImageUrl,
  matchedAssets,
  assetImageUrls,
  assetReferenceImages,
  generatingAssetName,
  generationStatus,
  onVideoPromptChange,
  isSelected,
  onSelect,
  onJumpToAsset,
}: {
  panel: StoryboardPanel;
  onModifyPanel?: (panel: StoryboardPanel, instruction: string) => Promise<void>;
  aspectRatio?: string;
  onGenerateImage?: (assetName: string, prompt: string, referenceImage?: string) => void;
  panelImageUrl?: string;
  matchedAssets?: string[];
  assetImageUrls?: Record<string, string>;
  assetReferenceImages?: Record<string, string>;
  generatingAssetName?: string | null;
  generationStatus?: "pending" | "generating" | "done" | "error";
  onVideoPromptChange?: (panelId: number, videoPrompt: string) => void;
  /** 是否为当前选中的面板 */
  isSelected?: boolean;
  /** 点击选中面板 */
  onSelect?: () => void;
  /** 点击资产名跳转到资产视图 */
  onJumpToAsset?: (assetName: string) => void;
}) {
  const isGridMode = /grid|宫格/i.test(panel.englishImagePrompt ?? "");
  const [copilotInstruction, setCopilotInstruction] = useState("");
  const [modifying, setModifying] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  const handleCopilot = async () => {
    const instr = copilotInstruction.trim();
    if (!instr) {
      setCopilotError("请先输入修改指令，例如：加一句角色台词。");
      return;
    }
    if (!onModifyPanel) return;
    setModifying(true);
    setCopilotError(null);
    try {
      await onModifyPanel(panel, instr);
      setCopilotInstruction("");
    } catch (e) {
      setCopilotError(
        e instanceof Error ? e.message : "Copilot 修改失败，请稍后重试。"
      );
    } finally {
      setModifying(false);
    }
  };

  // 根据当前画幅选择占位容器的宽高比 & 提示文案
  const ratio = aspectRatio ?? "16:9";
  const ratioClass =
    ratio === "9:16"
      ? "aspect-[9/16]"
      : ratio === "1:1"
        ? "aspect-square"
        : ratio === "3:4"
          ? "aspect-[3/4]"
          : "aspect-video";
  const ratioLabel =
    ratio === "9:16"
      ? "竖屏短视频位"
      : ratio === "1:1"
        ? "方形封面位"
        : ratio === "3:4"
          ? "漫画格子位"
          : "横屏宽画幅位";

  const panelKey = `panel-${panel.panelId}`;
  const isGenerating = generatingAssetName === panelKey;

  // 自动查找最佳参考图（优先用户上传的参考图）
  const bestReferenceImage = matchedAssets?.length
    ? (assetReferenceImages?.[matchedAssets[0]] ?? assetImageUrls?.[matchedAssets[0]])
    : undefined;

  return (
    <article
      onClick={onSelect}
      className={`filmstrip-card animate-card-enter flex gap-4 rounded-xl border p-4 pt-5 pb-5 shadow-lg transition-all ${
        isSelected
          ? "filmstrip-card-selected border-violet-500/50 bg-zinc-800 shadow-violet-500/10 ring-1 ring-violet-500/20"
          : generationStatus === "generating"
            ? "border-amber-500/50 bg-zinc-800/90 animate-status-generating"
            : generationStatus === "done"
              ? "border-emerald-500/40 bg-zinc-800/90"
              : generationStatus === "error"
                ? "border-red-500/40 bg-zinc-800/90"
                : "border-zinc-700/80 bg-zinc-800/80 shadow-black/20 hover:border-zinc-600/80 hover:-translate-y-0.5"
      }`}
      style={{ animationDelay: `${(panel.panelId - 1) * 50}ms` }}
    >
      {/* 左侧画幅区（已生图显示图片，未生图显示占位） */}
      <div className={isSelected ? "w-[320px] shrink-0" : "w-[280px] shrink-0"}>
        {panelImageUrl ? (
          <div className={`group w-full overflow-hidden rounded-lg border border-zinc-600/80 ${ratioClass}`}>
            <img
              src={panelImageUrl}
              alt={`分镜 #${panel.panelId}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-600/80 bg-zinc-900/60 text-center text-xs text-zinc-500 ${ratioClass}`}
          >
            <span>
              {ratio} 占位（Nano Banana 生图位）
            </span>
            <span className="text-[11px] text-zinc-400/90">{ratioLabel}</span>
            {isGridMode && (
              <span className="text-amber-400/80">宫格排版位</span>
            )}
          </div>
        )}
        {/* 单张生图按钮 */}
        {onGenerateImage && (
          <button
            type="button"
            disabled={isGenerating}
            onClick={() =>
              onGenerateImage(
                panelKey,
                panel.englishImagePrompt ?? panel.chineseDirectorNotes ?? "",
                bestReferenceImage
              )
            }
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/40 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500/70 hover:bg-emerald-950/60 disabled:pointer-events-none disabled:opacity-60"
          >
            {isGenerating
              ? "生成中…"
              : generationStatus === "error"
                ? "🔁 重试"
                : panelImageUrl
                  ? "🔄 重新生成"
                  : "✨ 生图"}
          </button>
        )}
      </div>
      {/* 右侧信息区 */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs font-bold text-violet-400/90">
            #{panel.panelId}
          </span>
          <span>{panel.timeRange ?? "—"}</span>
          {generationStatus === "generating" && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] text-amber-200">
              <Loader2 className="size-3 animate-spin" /> 生成中
            </span>
          )}
          {generationStatus === "done" && (
            <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-200">
              ✓ 已完成
            </span>
          )}
          {generationStatus === "error" && (
            <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] text-red-200">
              ✕ 失败
            </span>
          )}
        </div>
        <div>
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            剧情动作
          </h4>
          <p className="text-base font-medium leading-relaxed text-zinc-100">
            {panel.chineseDirectorNotes ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-950/70 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-500/30">
            🎥 {panel.shotSizeAndCamera?.trim() || "—"}
          </span>
          {panel.audioCues && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-950/70 px-2.5 py-1 text-xs font-medium text-sky-200 ring-1 ring-sky-500/30">
              🔊 {panel.audioCues.trim()}
            </span>
          )}
          {panel.transitionToNext && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-950/70 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/30">
              ✂️ {panel.transitionToNext.trim()}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            场记与资产
          </h4>
          {panel.continuityCheck && (
            <div className="rounded-lg border-2 border-amber-500/50 bg-amber-950/25 px-3 py-2 text-xs leading-relaxed text-amber-200/95">
              {panel.continuityCheck}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(panel.assetsUsed ?? []).map((name, i) => (
              <span
                key={i}
                className="rounded bg-zinc-700/80 px-2 py-0.5 text-xs text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
          {/* 自动匹配资产缩略图 */}
          {matchedAssets && matchedAssets.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[11px] font-semibold tracking-wider text-zinc-500">
                自动匹配资产（生图时将作为参考）
              </h5>
              <div className="flex flex-wrap gap-2">
                {matchedAssets.map((name) => {
                  const img =
                    assetReferenceImages?.[name] ?? assetImageUrls?.[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToAsset?.(name);
                      }}
                      className="flex items-center gap-1.5 rounded-md bg-zinc-700/60 px-2 py-1 ring-1 ring-zinc-600/40 transition-colors hover:bg-violet-900/40 hover:ring-violet-500/30"
                      title={`点击查看资产: ${name}`}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={name}
                          className="size-6 rounded object-cover"
                        />
                      ) : (
                        <span className="flex size-6 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
                          ?
                        </span>
                      )}
                      <span className="max-w-[6rem] truncate text-[11px] text-zinc-300">
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {panel.imageReferences && panel.imageReferences.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[11px] font-semibold tracking-wider text-zinc-500">
                提示词参考权重
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {panel.imageReferences.map((ref, idx) => {
                  const weight =
                    typeof ref.weight === "number" ? ref.weight : undefined;
                  const labelParts = [
                    ref.assetName || "未命名资产",
                    ref.referenceType,
                  ].filter(Boolean);
                  const label = labelParts.join(" · ");
                  const weightText =
                    weight !== undefined ? weight.toFixed(2) : undefined;
                  const strong = weight !== undefined && weight >= 0.75;
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                        strong
                          ? "bg-emerald-900/70 text-emerald-100 ring-1 ring-emerald-500/40"
                          : "bg-zinc-700/80 text-zinc-100 ring-1 ring-zinc-500/30"
                      }`}
                    >
                      <span className="max-w-[10rem] truncate">{label}</span>
                      {weightText && (
                        <span className="text-[10px] opacity-80">
                          权重 {weightText}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            核心提示词引擎
          </h4>
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-xs text-zinc-500">
                📷 生图提示词 (English Image Prompt)
              </span>
              <CopyBlock value={panel.englishImagePrompt ?? ""} />
            </div>
            {panel.videoPrompt !== undefined && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    🎬 视频提示词 (可灵 / Kling)
                  </span>
                  {onVideoPromptChange && (
                    <span className="text-[10px] text-zinc-500">可编辑</span>
                  )}
                </div>
                {onVideoPromptChange ? (
                  <div className="relative">
                    <textarea
                      value={panel.videoPrompt ?? ""}
                      onChange={(e) => onVideoPromptChange(panel.panelId, e.target.value)}
                      className="w-full min-h-[6rem] resize-y rounded-lg border border-zinc-700/50 bg-zinc-950/50 p-3 font-mono text-xs leading-relaxed text-zinc-300 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 [scrollbar-color:theme(colors.zinc.600)_transparent] [scrollbar-width:thin]"
                    />
                  </div>
                ) : (
                  <CopyBlock value={panel.videoPrompt ?? ""} />
                )}
              </div>
            )}
          </div>
        </div>
        {/* Copilot 分镜智能修改区 */}
        {onModifyPanel && (
          <div className="space-y-2 rounded-lg border border-zinc-700/80 bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                🤖 分镜 Copilot 智能修改
              </span>
            </div>
            <textarea
              value={copilotInstruction}
              onChange={(e) => setCopilotInstruction(e.target.value)}
              placeholder="例如：给角色加一句内心独白；把大炮改成激光枪并同步到提示词。"
              className="w-full resize-y rounded-md border border-zinc-700/70 bg-zinc-950/70 p-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/60"
              rows={3}
            />
            <div className="flex items-center justify-between gap-2">
              {copilotError && (
                <p className="flex-1 text-[11px] text-red-400">
                  {copilotError}
                </p>
              )}
              <button
                type="button"
                onClick={handleCopilot}
                disabled={modifying}
                className="shrink-0 rounded-md border border-violet-500/60 bg-violet-600/40 px-3 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-600/70 disabled:pointer-events-none disabled:opacity-60"
              >
                {modifying ? "Copilot 修改中…" : "✨ Copilot 修改本分镜"}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function PreviewPanel({
  isAnalyzing,
  data,
  currentView = "assets",
  onViewChange,
  storyboardResult = null,
  assetImageUrls = {},
  onGenerateImage,
  generatingAssetName = null,
  generateImageError,
  onModifyPanel,
  aspectRatio,
  assetDescOverrides,
  onAssetDescriptionChange,
  assetReferenceImages,
  onAssetReferenceImageChange,
  onPanelReferenceImageChange,
  panelReferenceImages = {},
  onRefineAsset,
  plan4Result = null,
  panelImageUrls = {},
  onBatchGenerateImages,
  analysisResult,
  panelGenerationStatus = {},
  onVideoPromptChange,
  onCancelBatch,
  /* Plan4Canvas forwarded props */
  initialCanvas,
  onCanvasChange,
  onCanvasGenerate,
  onClearPanelImage,
  onClearAssetImage,
  textProvider,
  textModel,
  textBaseUrl,
  textApiKey,
  videoBaseUrl,
  videoApiKey,
  videoModel,
  videoApiKeys,
  voiceApiKey,
  voiceAudioUrls,
  onVoiceGenerated,
}: PreviewPanelProps & {
  initialCanvas?: Plan4CanvasState | null;
  onCanvasChange?: (canvas: Plan4CanvasState) => void;
  onCanvasGenerate?: (
    nodeId: string,
    prompt: string,
    referenceImages?: string[],
    style?: string,
    taskType?: ImageTaskType,
    assetType?: ImageAssetType,
    referenceMetas?: ImageReferenceMeta[]
  ) => Promise<string | undefined>;
  onClearPanelImage?: (panelId: string) => void;
  onClearAssetImage?: (assetName: string | string[]) => void;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textBaseUrl?: string;
  textApiKey?: string;
  videoBaseUrl?: string;
  videoApiKey?: string;
  videoModel?: string;
  voiceAudioUrls?: Record<string, string>;
  onVoiceGenerated?: (panelId: string, audioUrl: string) => void;
}) {
  const [batchConcurrency, setBatchConcurrency] = useState<number>(3);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchDoneCount, setBatchDoneCount] = useState(0);
  const [batchTotalCount, setBatchTotalCount] = useState(0);
  const [skipExisting, setSkipExisting] = useState(true);
  const batchAbortRef = useRef<AbortController | null>(null);
  /** 当前选中的分镜面板 ID */
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  /** 从资产跳转到分镜时，高亮的面板 ID 列表 */
  const [, setHighlightPanelIds] = useState<number[]>([]);
  /** 从分镜跳转到资产时，滚动到的资产名 */
  const [scrollToAsset, setScrollToAsset] = useState<string | null>(null);
  const assetsContainerRef = useRef<HTMLDivElement>(null);

  // 从分镜跳转到资产时，滚动到指定资产卡片
  useEffect(() => {
    if (scrollToAsset && currentView === "assets") {
      const el = document.getElementById(`asset-${scrollToAsset}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-violet-500/50");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-violet-500/50");
        }, 2000);
      }
      setScrollToAsset(null);
    }
  }, [scrollToAsset, currentView]);

  // 计算每个资产被哪些分镜引用
  const assetPanelMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    if (!storyboardResult?.panels || !data) return map;
    const allAssetNames: string[] = [];
    for (const cfg of ASSET_TYPE_CONFIG) {
      const items = (data as any)[cfg.key] as { name: string }[] | undefined;
      if (items) allAssetNames.push(...items.map((a) => a.name));
    }
    for (const panel of storyboardResult.panels) {
      const used = panel.assetsUsed ?? [];
      for (const name of used) {
        const matched = allAssetNames.find(
          (a) => a === name || name.includes(a) || a.includes(name)
        );
        if (matched) {
          if (!map[matched]) map[matched] = [];
          map[matched].push(panel.panelId);
        }
      }
    }
    return map;
  }, [data, storyboardResult]);

  const handleJumpToAsset = (assetName: string) => {
    setScrollToAsset(assetName);
    onViewChange?.("assets");
  };

  const handleJumpToStoryboard = (panelIds: number[]) => {
    setHighlightPanelIds(panelIds);
    setSelectedPanelId(panelIds[0] ?? null);
    onViewChange?.("storyboard");
    // 滚动到第一个面板
    setTimeout(() => {
      const el = document.getElementById(`panel-${panelIds[0]}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  if (isAnalyzing) {
    return (
      <div className="flex h-full w-full min-w-0 flex-col bg-black">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <div className="relative">
            <div className="size-14 animate-pulse rounded-full border-2 border-violet-500/50 bg-violet-500/20" />
            <div className="absolute inset-0 size-14 animate-ping rounded-full border-2 border-violet-400/30" />
          </div>
          <p className="text-center text-sm font-medium text-zinc-300">
            正在请 AI 导演进行剧本围读，生成概念描述...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-black">
      {onViewChange && (
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800/60 bg-black px-4 py-2">
          <div className="flex gap-1 rounded-xl bg-zinc-900/80 p-1 ring-1 ring-zinc-800/60">
            <button
              type="button"
              onClick={() => onViewChange("assets")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                currentView === "assets"
                  ? "bg-zinc-800 text-zinc-100 shadow-inner ring-1 ring-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <User className="size-3.5" /> 资产
            </button>
            <button
              type="button"
              onClick={() => onViewChange("storyboard")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                currentView === "storyboard"
                  ? "bg-zinc-800 text-zinc-100 shadow-inner ring-1 ring-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Clapperboard className="size-3.5" /> 分镜
            </button>
            <button
              type="button"
              onClick={() => onViewChange("plan4")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                currentView === "plan4"
                  ? "bg-zinc-800 text-zinc-100 shadow-inner ring-1 ring-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <LayoutGrid className="size-3.5" /> 画布
            </button>
            <button
              type="button"
              onClick={() => onViewChange("voice")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                currentView === "voice"
                  ? "bg-zinc-800 text-zinc-100 shadow-inner ring-1 ring-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Mic className="size-3.5" /> 配音
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {currentView === "plan4" ? (
          <Plan4Canvas
            analysisResult={data}
            storyboardResult={storyboardResult}
            plan4Result={plan4Result}
            assetImageUrls={assetImageUrls}
            assetReferenceImages={assetReferenceImages}
            panelImageUrls={panelImageUrls}
            initialCanvas={initialCanvas}
            onCanvasChange={onCanvasChange}
            onGenerate={onCanvasGenerate}
            onClearPanelImage={onClearPanelImage}
            onClearAssetImage={onClearAssetImage}
            onAssetReferenceImageChange={onAssetReferenceImageChange}
            onPanelReferenceImageChange={onPanelReferenceImageChange}
            panelReferenceImages={panelReferenceImages}
            textProvider={textProvider}
            textModel={textModel}
            textBaseUrl={textBaseUrl}
            textApiKey={textApiKey}
            videoBaseUrl={videoBaseUrl}
            videoApiKey={videoApiKey}
            videoModel={videoModel}
            videoApiKeys={videoApiKeys}
            voiceAudioUrls={voiceAudioUrls}
            onVoiceGenerated={onVoiceGenerated}
          />
        ) : currentView === "storyboard" ? (
          storyboardResult ? (
            <>
              {storyboardResult.meta && (
                <div className="mb-6 flex flex-col gap-4 rounded-xl border-2 border-violet-900/60 bg-zinc-950 px-5 py-4 shadow-inner sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-400/90">
                        全局环境锁
                      </div>
                      <div className="mb-2 text-sm font-medium text-zinc-200">
                        ⏱ {storyboardResult.meta.totalDuration ?? "—"}
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {storyboardResult.meta.globalEnvironment ?? "—"}
                      </p>
                    </div>
                    {storyboardResult.meta.stylePrefix && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          画风前缀 (Style Prefix)
                        </span>
                        <CopyBlock value={storyboardResult.meta.stylePrefix} />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!storyboardResult) return;
                        const blob = new Blob(
                          [JSON.stringify(storyboardResult, null, 2)],
                          { type: "application/json" }
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `storyboard-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="rounded-md border border-violet-500/70 bg-violet-900/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-900/70"
                    >
                      导出 JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-md border border-zinc-600/80 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700/80"
                    >
                      打印分镜
                    </button>
                  </div>
                </div>
              )}
              {/* 批量生图工具栏 */}
              {onBatchGenerateImages && (storyboardResult.panels ?? []).length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-400">并发数</span>
                    <select
                      value={batchConcurrency}
                      onChange={(e) => setBatchConcurrency(Number(e.target.value))}
                      disabled={isBatchGenerating}
                      className="rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
                    >
                      <option value={1}>1</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={999}>全部</option>
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900 text-violet-500 focus:ring-violet-500/40"
                      checked={skipExisting}
                      onChange={(e) => setSkipExisting(e.target.checked)}
                      disabled={isBatchGenerating}
                    />
                    跳过已生成
                  </label>
                  <button
                    type="button"
                    disabled={isBatchGenerating}
                    onClick={async () => {
                      let panels = storyboardResult.panels ?? [];
                      if (!panels.length) return;
                      if (skipExisting) {
                        panels = panels.filter((p) => !panelImageUrls[`panel-${p.panelId}`]);
                      }
                      if (!panels.length) return;
                      setIsBatchGenerating(true);
                      setBatchTotalCount(panels.length);
                      setBatchDoneCount(0);
                      const controller = new AbortController();
                      batchAbortRef.current = controller;
                      try {
                        const concurrency = batchConcurrency === 999 ? panels.length : batchConcurrency;
                        await onBatchGenerateImages(
                          panels,
                          concurrency,
                          (done, total) => {
                            setBatchDoneCount(done);
                            setBatchTotalCount(total);
                          },
                          controller.signal
                        );
                      } finally {
                        setIsBatchGenerating(false);
                        batchAbortRef.current = null;
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-sky-500/60 bg-sky-950/50 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-950/70 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {isBatchGenerating ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        批量生图中…
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        批量生图
                      </>
                    )}
                  </button>
                  {isBatchGenerating && (
                    <button
                      type="button"
                      onClick={() => {
                        batchAbortRef.current?.abort();
                        onCancelBatch?.();
                      }}
                      className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/50"
                    >
                      ✕ 取消
                    </button>
                  )}
                  {isBatchGenerating && batchTotalCount > 0 && (
                    <span className="text-xs text-zinc-400">
                      {batchDoneCount}/{batchTotalCount} 已完成
                    </span>
                  )}
                </div>
              )}
              {/* 分镜快速索引条 */}
              {(storyboardResult.panels ?? []).length > 3 && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-3 py-2">
                  <span className="mr-1 text-[11px] text-zinc-500">快速跳转</span>
                  {(storyboardResult.panels ?? []).map((panel) => {
                    const panelKey = `panel-${panel.panelId}`;
                    const status = panelGenerationStatus[panelKey];
                    const isSelected = selectedPanelId === panel.panelId;
                    return (
                      <button
                        key={panel.panelId}
                        type="button"
                        onClick={() => {
                          setSelectedPanelId(panel.panelId);
                          const el = document.getElementById(panelKey);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`flex size-7 items-center justify-center rounded text-[11px] font-medium transition-all ${
                          isSelected
                            ? "bg-violet-600 text-white shadow-md shadow-violet-500/30"
                            : status === "done"
                              ? "bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/60"
                              : status === "error"
                                ? "bg-red-900/50 text-red-300 hover:bg-red-800/60"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                        }`}
                        title={`#${panel.panelId}`}
                      >
                        {panel.panelId}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="space-y-6">
                {(() => {
                  const allAssetNames = extractAllAssetNames(analysisResult ?? null);
                  return (storyboardResult.panels ?? []).map((panel, i) => {
                    const panelKey = `panel-${panel.panelId}`;
                    const matched = matchAssets(panel.assetsUsed ?? [], allAssetNames);
                    return (
                      <div key={panel.panelId ?? i} id={panelKey}>
                        <StoryboardPanelCard
                          panel={panel}
                          onModifyPanel={onModifyPanel}
                          aspectRatio={aspectRatio}
                          onGenerateImage={onGenerateImage}
                          panelImageUrl={panelImageUrls[panelKey]}
                          matchedAssets={matched}
                          assetImageUrls={assetImageUrls}
                          assetReferenceImages={assetReferenceImages}
                          generatingAssetName={generatingAssetName}
                          generationStatus={panelGenerationStatus[panelKey]}
                          onVideoPromptChange={onVideoPromptChange}
                          isSelected={selectedPanelId === panel.panelId}
                          onSelect={() => setSelectedPanelId(panel.panelId)}
                          onJumpToAsset={handleJumpToAsset}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">
              请先点击「🎬 Action！生成动态分镜」生成导演级分镜。
            </p>
          )
        ) : currentView === "voice" ? (
          <div className="p-4">
            {storyboardResult?.panels && storyboardResult.panels.length > 0 ? (
              <VoicePanel
                dialogues={storyboardResult.panels.map((panel) => ({
                  panelId: String(panel.panelId),
                  text: panel.chineseDirectorNotes ?? "",
                }))}
                apiKey={voiceApiKey ?? ""}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Mic className="mb-4 size-12 text-zinc-600" />
                <p className="text-sm text-zinc-400 mb-2">暂无分镜台词</p>
                <p className="text-xs text-zinc-500">
                  请先在左侧输入剧本并生成分镜，然后返回配音页面
                </p>
              </div>
            )}
          </div>
        ) : data ? (
          <div ref={assetsContainerRef}>
            {generateImageError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                ❌ 生图失败：{generateImageError}
              </div>
            )}
            {/* 定妆进度指示器 */}
            <AssetProgress
              data={data}
              assetImageUrls={assetImageUrls}
              assetReferenceImages={assetReferenceImages}
            />
            {data.directorNotes && (
              <blockquote className="mb-6 rounded-xl border-l-4 border-violet-500/80 bg-zinc-800/60 px-5 py-4 text-sm italic leading-relaxed text-zinc-200 shadow-inner">
                {data.directorNotes}
              </blockquote>
            )}
            {data.characters?.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
                  <User className="size-4" /> 登场角色
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.characters.map((c) => (
                    <div key={c.name} id={`asset-${c.name}`}>
                      <AssetCard
                        name={c.name}
                        typeLabel={c.role ?? "角色"}
                        description={
                          (assetDescOverrides && assetDescOverrides[c.name]) ??
                          c.description ??
                          ""
                        }
                        imageUrl={assetImageUrls[c.name]}
                        referenceImage={assetReferenceImages?.[c.name]}
                        onGenerateImage={onGenerateImage}
                        isGenerating={generatingAssetName === c.name}
                        onDescriptionChange={
                          onAssetDescriptionChange
                            ? (value) => onAssetDescriptionChange(c.name, value)
                            : undefined
                        }
                        onReferenceImageChange={
                          onAssetReferenceImageChange
                            ? (img) => onAssetReferenceImageChange(c.name, img)
                            : undefined
                        }
                        onRefineAsset={onRefineAsset}
                        detailBlocks={(c.states ?? []).map((s) => ({
                          title: s.stateName,
                          body: s.description,
                        }))}
                        referencedByPanels={assetPanelMap[c.name]}
                        onJumpToStoryboard={handleJumpToStoryboard}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {data.creatures?.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
                  <Rabbit className="size-4" /> 关键生物
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.creatures.map((c) => (
                    <div key={c.name} id={`asset-${c.name}`}>
                      <AssetCard
                        name={c.name}
                        typeLabel={c.type ?? "生物"}
                        description={
                          (assetDescOverrides && assetDescOverrides[c.name]) ??
                          c.description ??
                          ""
                        }
                        imageUrl={assetImageUrls[c.name]}
                        referenceImage={assetReferenceImages?.[c.name]}
                        onGenerateImage={onGenerateImage}
                        isGenerating={generatingAssetName === c.name}
                        onDescriptionChange={
                          onAssetDescriptionChange
                            ? (value) => onAssetDescriptionChange(c.name, value)
                            : undefined
                        }
                        onReferenceImageChange={
                          onAssetReferenceImageChange
                            ? (img) => onAssetReferenceImageChange(c.name, img)
                            : undefined
                        }
                        onRefineAsset={onRefineAsset}
                        referencedByPanels={assetPanelMap[c.name]}
                        onJumpToStoryboard={handleJumpToStoryboard}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {data.scenes?.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
                  <MapPin className="size-4" /> 核心场景
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.scenes.map((s) => (
                    <div key={s.name} id={`asset-${s.name}`}>
                      <AssetCard
                        name={s.name}
                        typeLabel="场景"
                        description={
                          (assetDescOverrides && assetDescOverrides[s.name]) ??
                          s.description ??
                          ""
                        }
                        imageUrl={assetImageUrls[s.name]}
                        referenceImage={assetReferenceImages?.[s.name]}
                        onGenerateImage={onGenerateImage}
                        isGenerating={generatingAssetName === s.name}
                        onDescriptionChange={
                          onAssetDescriptionChange
                            ? (value) => onAssetDescriptionChange(s.name, value)
                            : undefined
                        }
                        onReferenceImageChange={
                          onAssetReferenceImageChange
                            ? (img) => onAssetReferenceImageChange(s.name, img)
                            : undefined
                        }
                        onRefineAsset={onRefineAsset}
                        referencedByPanels={assetPanelMap[s.name]}
                        onJumpToStoryboard={handleJumpToStoryboard}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {(data.cockpits ?? []).length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
                  <Settings className="size-4" /> 机舱 / 驾驶舱 / 舰桥
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(data.cockpits ?? []).map((cock) => {
                    const extra: { title: string; body: string }[] = [];
                    if (cock.hostAsset?.trim()) {
                      extra.push({
                        title: "关联载具 / 机体",
                        body: cock.hostAsset.trim(),
                      });
                    }
                    if (cock.occupantsHint?.trim()) {
                      extra.push({
                        title: "乘员 / 操作者",
                        body: cock.occupantsHint.trim(),
                      });
                    }
                    return (
                      <div key={cock.name} id={`asset-${cock.name}`}>
                        <AssetCard
                          name={cock.name}
                          typeLabel="座舱空间"
                          description={
                            (assetDescOverrides &&
                              assetDescOverrides[cock.name]) ??
                            cock.description ??
                            ""
                          }
                          imageUrl={assetImageUrls[cock.name]}
                          referenceImage={assetReferenceImages?.[cock.name]}
                          onGenerateImage={onGenerateImage}
                          isGenerating={generatingAssetName === cock.name}
                          onDescriptionChange={
                            onAssetDescriptionChange
                              ? (value) =>
                                  onAssetDescriptionChange(cock.name, value)
                              : undefined
                          }
                          onReferenceImageChange={
                            onAssetReferenceImageChange
                              ? (img) =>
                                  onAssetReferenceImageChange(cock.name, img)
                              : undefined
                          }
                          onRefineAsset={onRefineAsset}
                          detailBlocks={extra.length > 0 ? extra : undefined}
                          referencedByPanels={assetPanelMap[cock.name]}
                          onJumpToStoryboard={handleJumpToStoryboard}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {data.props?.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
                  <Package className="size-4" /> 重要道具
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.props.map((p) => (
                    <div key={p.name} id={`asset-${p.name}`}>
                      <AssetCard
                        name={p.name}
                        typeLabel="道具"
                        description={
                          (assetDescOverrides && assetDescOverrides[p.name]) ??
                          p.description ??
                          ""
                        }
                        imageUrl={assetImageUrls[p.name]}
                        referenceImage={assetReferenceImages?.[p.name]}
                        onGenerateImage={onGenerateImage}
                        isGenerating={generatingAssetName === p.name}
                        onDescriptionChange={
                          onAssetDescriptionChange
                            ? (value) => onAssetDescriptionChange(p.name, value)
                            : undefined
                        }
                        onReferenceImageChange={
                          onAssetReferenceImageChange
                            ? (img) => onAssetReferenceImageChange(p.name, img)
                            : undefined
                        }
                        onRefineAsset={onRefineAsset}
                        detailBlocks={(p.variants ?? []).map((v) => ({
                          title: v.variantName,
                          body: v.description,
                        }))}
                        referencedByPanels={assetPanelMap[p.name]}
                        onJumpToStoryboard={handleJumpToStoryboard}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8">
            <Clapperboard
              className="mb-4 size-16 text-zinc-800"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="max-w-sm text-center text-sm tracking-wide text-zinc-600">
              请在左侧输入剧本，AI 将为您拆解角色、场景与分镜。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
