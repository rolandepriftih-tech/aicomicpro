"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, ImagePlus, X } from "lucide-react";
import ImageGenLogMonitor from "./ImageGenLogMonitor";
import type { AnalyzeAssetsResponse } from "@/types/analyze";
import { LocalStorage } from "@/lib/storage";
import { DEFAULT_STYLE, STYLE_LIST } from "@/lib/style-config";
import type { ImageReferenceMode } from "@/lib/image-runtime-options";

const STORAGE_KEY = "ai-comic-pro:scriptPanelState";

export type StoryboardPlan = "plan1" | "plan2" | "plan3" | "plan4";

const PLAN_OPTIONS: { value: StoryboardPlan; label: string; desc: string }[] = [
  { value: "plan1", label: "方案一：忠实原著", desc: "逐句拆解，绝不删减剧本内容" },
  { value: "plan2", label: "方案二：爆款编导", desc: "网感美化，开头结尾强化钩子与悬念" },
  { value: "plan3", label: "方案三：连贯强化", desc: "专攻单场戏，动作极其细腻连贯" },
  {
    value: "plan4",
    label: "方案四：导演 + 分镜生图管线",
    desc: "先出分镜与提示词，再为每格指定首尾帧 / 多参考 / 九宫格等生图方式（框架）",
  },
];

export interface ScriptPanelSavedState {
  script: string;
  plan: StoryboardPlan;
  style: string;
  aspect: string;
}

const DEFAULT_SCRIPT_PANEL_STATE: ScriptPanelSavedState = {
  script: "",
  plan: "plan1",
  style: DEFAULT_STYLE,
  aspect: "16:9",
};

/** 深度分析时允许的参考图槽位数（与 /api/analyze 一致） */
const ANALYSIS_REF_IMAGE_SLOTS = 3;

/**
 * 将用户选择的参考图压到适中尺寸再转 JPEG data URL，避免 JSON 请求体过大。
 */
async function compressImageFileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 1280;
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > maxEdge || h > maxEdge) {
      const r = Math.min(maxEdge / w, maxEdge / h);
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    bitmap.close();
  }
}

export type AnalyzeRequestPayload = {
  script: string;
  apiKey: string;
  mode: 1 | 2 | 3;
  aspectRatio?: string;
  textModel?: string;
  /** 画面风格枚举值，用于告诉后端当前目标画风 */
  style?: string;
  /** 最多 3 张 data URL，供多模态剧本分析 */
  referenceImages?: string[];
};

export interface ScriptPanelProps {
  onAnalyzed?: (data: AnalyzeAssetsResponse) => void;
  onReset?: () => void;
  onAnalyzeRequest?: (payload: AnalyzeRequestPayload) => Promise<void>;
  isAnalyzing?: boolean;
  onGenerateStoryboard?: (payload: AnalyzeRequestPayload) => Promise<void>;
  isGeneratingStoryboard?: boolean;
  generateStoryboardError?: string | null;
  textProvider?: "gemini" | "openai";
  onTextProviderChange?: (v: "gemini" | "openai") => void;
  textModel?: string;
  onTextModelChange?: (v: string) => void;
  textBaseUrl?: string;
  onTextBaseUrlChange?: (v: string) => void;
  textApiKey?: string;
  onTextApiKeyChange?: (v: string) => void;
  imageProvider?: "gemini" | "openai";
  onImageProviderChange?: (v: "gemini" | "openai") => void;
  imageEngine?: string;
  onImageEngineChange?: (v: string) => void;
  imageModel?: string;
  onImageModelChange?: (v: string) => void;
  imageReferenceMode?: ImageReferenceMode;
  onImageReferenceModeChange?: (v: ImageReferenceMode) => void;
  imageTimeoutMinutes?: number;
  onImageTimeoutMinutesChange?: (v: number) => void;
  imageBaseUrl?: string;
  onImageBaseUrlChange?: (v: string) => void;
  imageApiKey?: string;
  onImageApiKeyChange?: (v: string) => void;
  videoBaseUrl?: string;
  onVideoBaseUrlChange?: (v: string) => void;
  videoApiKey?: string;
  onVideoApiKeyChange?: (v: string) => void;
  videoModel?: string;
  onVideoModelChange?: (v: string) => void;
  isTestingAPI?: boolean;
  testResult?: { text: boolean; image: boolean; msg: string } | null;
  onTestAPI?: () => void;
  /** 将当前选中的画面风格同步给上层，用于生图等接口复用 */
  onStyleChange?: (style: string) => void;
  /** 方案四：请求导演大纲（分镜 + 每格生图策略），与经典分镜并列为独立流程 */
  onPlan4DirectorOutline?: (payload: AnalyzeRequestPayload) => Promise<void>;
  isGeneratingPlan4?: boolean;
  plan4Error?: string | null;
  /** 直接进入方案四画布（不需要先分析资产） */
  onEnterPlan4Canvas?: () => void;
  /** 语音合成 API Key */
  voiceApiKey?: string;
  onVoiceApiKeyChange?: (v: string) => void;
}

/**
 * 左侧剧本输入与引擎控制台面板。
 * - 负责收集剧本、API Key、Base URL、导演模式、画风与画幅等信息
 * - 通过 props 将请求下发给 page.tsx 中的 handler，保持页面逻辑单一
 */
export default function ScriptPanel({
  onReset,
  onAnalyzeRequest,
  isAnalyzing: isAnalyzingFromParent,
  onGenerateStoryboard,
  isGeneratingStoryboard,
  generateStoryboardError,
  textProvider = "gemini",
  onTextProviderChange,
  textModel = "gemini-2.5-pro",
  onTextModelChange,
  textBaseUrl = "https://api.openai.com/v1",
  onTextBaseUrlChange,
  textApiKey = "",
  onTextApiKeyChange,
  imageProvider = "gemini",
  onImageProviderChange,
  imageEngine = "nano-banana-2",
  onImageEngineChange,
  imageModel = "dall-e-3",
  onImageModelChange,
  imageReferenceMode = "auto",
  onImageReferenceModeChange,
  imageTimeoutMinutes = 10,
  onImageTimeoutMinutesChange,
  imageBaseUrl = "https://api.openai.com/v1",
  onImageBaseUrlChange,
  imageApiKey = "",
  onImageApiKeyChange,
  videoBaseUrl = "https://ark.cn-beijing.volces.com/api/plan/v3",
  onVideoBaseUrlChange,
  videoApiKey = "",
  onVideoApiKeyChange,
  videoModel = "",
  onVideoModelChange,
  isTestingAPI = false,
  testResult = null,
  onTestAPI,
  onStyleChange,
  onPlan4DirectorOutline,
  isGeneratingPlan4 = false,
  plan4Error = null,
  onEnterPlan4Canvas,
  voiceApiKey = "",
  onVoiceApiKeyChange,
}: ScriptPanelProps) {
  const [saved, setSaved] = useState<ScriptPanelSavedState>(DEFAULT_SCRIPT_PANEL_STATE);
  const [mounted, setMounted] = useState(false);

  // 首次挂载时从localStorage恢复
  useEffect(() => {
    const stored = LocalStorage.get<ScriptPanelSavedState>(STORAGE_KEY);
    if (stored) setSaved(stored);
    setMounted(true);
  }, []);

  // 防抖持久化剧本、风格、画幅、方案选择；大剧本文本每个按键都写 localStorage 会拖慢输入。
  useEffect(() => {
    if (!mounted) return;
    const timer = window.setTimeout(() => {
      LocalStorage.set(STORAGE_KEY, saved);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [saved, mounted]);

  useEffect(() => {
    if (!mounted) return;
    onStyleChange?.(saved.style);
  }, [mounted, onStyleChange, saved.style]);
  const [engineOpen, setEngineOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /** 深度分析附带的参考图（压缩后的 data URL），最多 3 张，不落盘 */
  const [analysisRefDataUrls, setAnalysisRefDataUrls] = useState<
    (string | null)[]
  >(() => Array.from({ length: ANALYSIS_REF_IMAGE_SLOTS }, () => null));
  const refFileInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const isAnalyzing = isAnalyzingFromParent ?? analyzing;

  const handleAnalyzeInner = async () => {
    setAnalyzeError(null);
    if (!saved.script.trim()) {
      setAnalyzeError("请先粘贴剧本内容");
      return;
    }
    if (!textApiKey.trim()) {
      setAnalyzeError("请填写文本引擎 API 密钥");
      return;
    }
    setAnalyzing(true);
    try {
      if (onAnalyzeRequest) {
        const referenceImages = analysisRefDataUrls.filter(
          (u): u is string => typeof u === "string" && u.length > 0
        );
        await onAnalyzeRequest({
          script: saved.script.trim(),
          apiKey: textApiKey.trim(),
          mode:
            saved.plan === "plan4"
              ? 1
              : saved.plan === "plan1"
                ? 1
                : saved.plan === "plan2"
                  ? 2
                  : 3,
          textModel,
          style: saved.style,
          referenceImages:
            referenceImages.length > 0 ? referenceImages : undefined,
        });
      }
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定要清空所有数据并重置吗？")
    ) {
      return;
    }
    setSaved(DEFAULT_SCRIPT_PANEL_STATE);
    setAnalysisRefDataUrls(
      Array.from({ length: ANALYSIS_REF_IMAGE_SLOTS }, () => null)
    );
    onReset?.();
  };

  const clearRefSlot = (index: number) => {
    setAnalysisRefDataUrls((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const onPickRefFile = async (index: number, file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setAnalyzeError(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      if (dataUrl.length > 3_000_000) {
        setAnalyzeError("参考图压缩后仍偏大，请换一张分辨率更低的图。");
        return;
      }
      setAnalysisRefDataUrls((prev) => {
        const next = [...prev];
        next[index] = dataUrl;
        return next;
      });
    } catch {
      setAnalyzeError("参考图读取失败，请重试或更换图片格式。");
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-zinc-100">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 pb-12">
        {/* 顶部标题 */}
        <header className="shrink-0">
          <h2 className="text-base font-bold text-zinc-200">
            🎬 剧本导入与分析
          </h2>
        </header>

        {/* 剧本输入区 */}
        <main className="min-h-[220px] flex-1 min-w-0">
          <textarea
            className="h-full min-h-[200px] w-full resize-none rounded-xl border border-zinc-800/60 bg-zinc-900/80 px-4 py-3.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:ring-offset-2 focus:ring-offset-zinc-950"
            placeholder="在这里粘贴你的长篇剧本或故事大纲..."
            value={saved.script}
            onChange={(e) =>
              setSaved((prev) => ({ ...prev, script: e.target.value }))
            }
          />
        </main>

        {/* 深度分析参考图：最多 3 张，随剧本一并送入多模态模型 */}
        <section className="shrink-0 space-y-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              分析参考图（可选，最多 3 张）
            </span>
            <span className="text-[10px] text-zinc-600">
              画风 / 人设 / 时代感
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            上传后会在「深度分析」时与剧本一起交给模型，用于对齐视觉基调；不会用于普通分镜按钮（除非再次分析）。
          </p>
          <div className="grid grid-cols-3 gap-2">
            {analysisRefDataUrls.map((url, index) => (
              <div
                key={index}
                className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/80"
              >
                <input
                  ref={(el) => {
                    refFileInputsRef.current[index] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void onPickRefFile(index, f);
                    e.target.value = "";
                  }}
                />
                {url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`参考图 ${index + 1}`}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => clearRefSlot(index)}
                      className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-md bg-black/70 text-zinc-200 hover:bg-red-900/80 hover:text-white"
                      aria-label={`移除参考图 ${index + 1}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => refFileInputsRef.current[index]?.click()}
                    className="flex size-full flex-col items-center justify-center gap-1 text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
                  >
                    <ImagePlus className="size-6 opacity-70" />
                    <span className="text-[10px]">槽位 {index + 1}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 引擎高级配置折叠区 */}
        <section className="shrink-0 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/80">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-800/50"
            onClick={() => setEngineOpen((o) => !o)}
          >
            <span>⚙️ 引擎高级配置</span>
            {engineOpen ? (
              <ChevronDown className="size-4 text-zinc-500" />
            ) : (
              <ChevronRight className="size-4 text-zinc-500" />
            )}
          </button>
          {engineOpen && (
            <div className="space-y-4 border-t border-zinc-800/60 px-4 pb-4 pt-3">
              {/* 文本推理大脑 */}
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <span>🧠</span>
                  <span>文本推理大脑</span>
                </div>
                <select
                  value={textProvider}
                  onChange={(e) => {
                    const v = e.target.value as "gemini" | "openai";
                    onTextProviderChange?.(v);
                    if (v === "gemini") {
                      onTextModelChange?.("gemini-2.5-pro");
                    } else {
                      onTextModelChange?.("gpt-4o");
                    }
                  }}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 focus:border-purple-500 focus:outline-none"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI 兼容</option>
                </select>
                {textProvider === "gemini" ? (
                  <select
                    value={textModel}
                    onChange={(e) => onTextModelChange?.(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={textModel}
                    onChange={(e) => onTextModelChange?.(e.target.value)}
                    placeholder="gpt-4o, claude-3-5-sonnet..."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                  />
                )}
                <input
                  type="url"
                  placeholder="https://.../v1"
                  value={textBaseUrl}
                  onChange={(e) => onTextBaseUrlChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="API Key"
                  value={textApiKey}
                  onChange={(e) => onTextApiKeyChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* 视觉渲染引擎 */}
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <span>🎨</span>
                  <span>视觉渲染引擎</span>
                </div>
                <select
                  value={imageProvider}
                  onChange={(e) => {
                    const v = e.target.value as "gemini" | "openai";
                    onImageProviderChange?.(v);
                    if (v === "gemini") {
                      onImageEngineChange?.("nano-banana-2");
                    } else {
                      onImageModelChange?.("dall-e-3");
                    }
                  }}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 focus:border-purple-500 focus:outline-none"
                >
                  <option value="gemini">Gemini (Imagen)</option>
                  <option value="openai">OpenAI 兼容</option>
                </select>
                {imageProvider === "gemini" ? (
                  <select
                    value={imageEngine}
                    onChange={(e) => onImageEngineChange?.(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="nano-banana-2">Nano Banana 2 (极速)</option>
                    <option value="nano-banana-pro">Nano Banana Pro (精调)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={imageModel}
                    onChange={(e) => onImageModelChange?.(e.target.value)}
                    placeholder="dall-e-3, ..."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                  />
                )}
                <select
                  value={imageReferenceMode}
                  onChange={(e) =>
                    onImageReferenceModeChange?.(
                      e.target.value as ImageReferenceMode
                    )
                  }
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 focus:border-purple-500 focus:outline-none"
                  title="关联资产/参考图的发送方式"
                >
                  <option value="auto">参考图：自动</option>
                  <option value="off">参考图：忽略，仅用文字</option>
                  <option value="image-edit">参考图：images.edit 上传</option>
                </select>
                <label className="block space-y-1">
                  <span className="text-[11px] text-zinc-500">
                    生图等待上限（分钟）
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={imageTimeoutMinutes}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      onImageTimeoutMinutesChange?.(
                        Math.min(10, Math.max(1, Math.round(n)))
                      );
                    }}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                  />
                </label>
                <input
                  type="url"
                  placeholder="https://.../v1"
                  value={imageBaseUrl}
                  onChange={(e) => onImageBaseUrlChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="API Key"
                  value={imageApiKey}
                  onChange={(e) => onImageApiKeyChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* 视频生成引擎 */}
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <span>🎬</span>
                  <span>视频生成引擎</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">Seedance (方舟)</span>
                  <span className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-cyan-400">MiniMax H3 (字字动画)</span>
                  <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-emerald-400">AutoDL ComfyUI</span>
                </div>
                <input
                  type="text"
                  placeholder="模型名 (留空使用默认值)"
                  value={videoModel}
                  onChange={(e) => onVideoModelChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <input
                  type="url"
                  placeholder="API Base URL (留空使用默认值)"
                  value={videoBaseUrl}
                  onChange={(e) => onVideoBaseUrlChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="Video API Key / AutoDL Token"
                  value={videoApiKey}
                  onChange={(e) => onVideoApiKeyChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* 语音合成引擎 */}
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <span>🎤</span>
                  <span>语音合成引擎 (小米 MiMo TTS)</span>
                </div>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="MiMo API Key"
                  value={voiceApiKey}
                  onChange={(e) => onVoiceApiKeyChange?.(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500">
                  API: https://token-plan-cn.xiaomimimo.com/v1
                </p>
              </div>

              <button
                type="button"
                onClick={onTestAPI}
                disabled={isTestingAPI}
                className="flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {isTestingAPI ? "⏳ 雷达扫描中..." : "🧪 测试双引擎连通性"}
              </button>
              {testResult && (
                <div className="space-y-1 text-[11px] text-zinc-300">
                  <div>
                    文本引擎：{" "}
                    <span className={testResult.text ? "text-emerald-400" : "text-red-400"}>
                      {testResult.text ? "✅ 正常" : "❌ 异常"}
                    </span>
                  </div>
                  <div>
                    视觉引擎：{" "}
                    <span className={testResult.image ? "text-emerald-400" : "text-red-400"}>
                      {testResult.image ? "✅ 正常" : "❌ 异常"}
                    </span>
                  </div>
                  {testResult.msg && (
                    <p className="whitespace-pre-line text-[10px] text-zinc-400">{testResult.msg}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <ImageGenLogMonitor />

        {/* 全局设置：风格 + 画幅 */}
        <section className="shrink-0 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            全局设置
          </span>

          {/* 画风选择网格 */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">画面风格</label>
            <div className="grid grid-cols-4 gap-1.5">
              {STYLE_LIST.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => {
                    setSaved((prev) => ({ ...prev, style: style.value }));
                    onStyleChange?.(style.value);
                  }}
                  className={`relative flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] leading-tight transition-all ${
                    saved.style === style.value
                      ? "ring-1 ring-white/60 bg-white/10 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}
                  title={`${style.label} / ${style.labelEn}`}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: style.color }}
                  />
                  <span className="truncate w-full text-center">{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="script-aspect"
                className="text-xs text-zinc-500"
              >
                画幅比例
              </label>
              <select
                id="script-aspect"
                className="w-full rounded-lg border-0 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950"
                value={saved.aspect}
                onChange={(e) =>
                  setSaved((prev) => ({ ...prev, aspect: e.target.value }))
                }
              >
                <option value="16:9">16:9 (横屏)</option>
                <option value="9:16">9:16 (竖屏)</option>
                <option value="1:1">1:1 (正方形)</option>
                <option value="3:4">3:4 (漫画)</option>
              </select>
            </div>
          </div>
        </section>

        {/* 导演分镜模式 */}
        <section className="shrink-0 rounded-lg border-2 border-violet-500/30 bg-zinc-900/90 px-4 py-3 shadow-inner">
          <h3 className="mb-3 text-sm font-bold text-zinc-200">
            🎞️ 导演分镜模式 (Storyboard Mode)
          </h3>
          <div className="space-y-2">
            {PLAN_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                  saved.plan === opt.value
                    ? "border-violet-500/60 bg-violet-950/40"
                    : "border-zinc-700/50 bg-zinc-800/50 hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="storyboard-plan"
                  value={opt.value}
                  checked={saved.plan === opt.value}
                  onChange={() =>
                    setSaved((prev) => ({ ...prev, plan: opt.value }))
                  }
                  className="mt-1 size-4 shrink-0 accent-violet-500"
                />
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-200">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {opt.desc}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* 错误提示 */}
        {analyzeError && (
          <p className="whitespace-pre-line text-sm text-red-400">{analyzeError}</p>
        )}

        {/* 底部操作按钮 */}
        <footer className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleAnalyzeInner}
            className="btn-primary-violet"
          >
            {isAnalyzing ? "分析中…" : "🧠 深度分析剧本提取资产"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex h-10 w-full items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
          >
            🗑️ 清空数据重置
          </button>
          {onEnterPlan4Canvas && (
            <button
              type="button"
              onClick={onEnterPlan4Canvas}
              className="flex h-10 w-full items-center justify-center rounded-lg border border-amber-600/50 bg-amber-950/30 px-4 text-sm font-medium text-amber-300 hover:bg-amber-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              🎛️ 进入方案四画布
            </button>
          )}
          {saved.plan === "plan4" && onPlan4DirectorOutline ? (
            <>
              <button
                type="button"
                disabled={isGeneratingPlan4}
                onClick={async () => {
                  if (!saved.script.trim()) {
                    setAnalyzeError("请先粘贴剧本内容");
                    return;
                  }
                  if (!textApiKey.trim()) {
                    setAnalyzeError("请填写文本引擎 API 密钥");
                    return;
                  }
                  setAnalyzeError(null);
                  try {
                    await onPlan4DirectorOutline({
                      script: saved.script.trim(),
                      apiKey: textApiKey.trim(),
                      mode: 1,
                      aspectRatio: saved.aspect || "16:9",
                      textModel,
                      style: saved.style,
                    });
                  } catch {
                    // plan4Error 由父组件展示
                  }
                }}
                className="btn-primary-amber"
              >
                {isGeneratingPlan4
                  ? "方案四导演编排中…"
                  : "🎛️ 生成方案四 · 导演大纲（分镜+生图策略）"}
              </button>
              {plan4Error && (
                <p className="whitespace-pre-line text-sm text-rose-400">
                  {plan4Error}
                </p>
              )}
            </>
          ) : (
            onGenerateStoryboard && (
              <>
                <button
                  type="button"
                  disabled={isGeneratingStoryboard}
                  onClick={async () => {
                    if (!saved.script.trim()) {
                      setAnalyzeError("请先粘贴剧本内容");
                      return;
                    }
                    if (!textApiKey.trim()) {
                      setAnalyzeError("请填写文本引擎 API 密钥");
                      return;
                    }
                    setAnalyzeError(null);
                    try {
                      await onGenerateStoryboard({
                        script: saved.script.trim(),
                        apiKey: textApiKey.trim(),
                        mode:
                          saved.plan === "plan1"
                            ? 1
                            : saved.plan === "plan2"
                              ? 2
                              : 3,
                        aspectRatio: saved.aspect || "16:9",
                        textModel,
                        style: saved.style,
                      });
                    } catch {
                      // 错误由父组件通过 generateStoryboardError 展示
                    }
                  }}
                  className="btn-primary-emerald"
                >
                  {isGeneratingStoryboard
                    ? "正在生成导演级分镜..."
                    : "🎬 Action！生成动态分镜"}
                </button>
                {generateStoryboardError && (
                  <p className="whitespace-pre-line text-sm text-amber-400">
                    {generateStoryboardError}
                  </p>
                )}
              </>
            )
          )}
        </footer>
      </div>
    </div>
  );
}
