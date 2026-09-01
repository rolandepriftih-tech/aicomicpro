"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Loader2,
  Wand2,
  ImageIcon,
  VideoIcon,
  AlertCircle,
  Copy,
  CheckCheck,
  Sparkles,
  FileImage,
  Layers,
  Settings2,
  Volume2,
  Film,
  Images,
  Mic,
  Smile,
  Music,
} from "lucide-react";
import {
  GenerationModeSelector,
  GENERATION_MODE_OPTIONS,
} from "./generation-modes";
import type { GenerationMode } from "./generation-modes";
import { SkillSelector } from "./skills";
import type { SkillConfig } from "@/lib/skills";
import {
  StoryboardPromptBuilder,
  type BuiltPrompt,
} from "@/lib/prompt-builders";
import type { StoryboardPanel, ShotType, CameraHeight, DepthOfField, Composition, CameraMovement, ActionRhythm } from "@/lib/templates/storyboard-template";
import { showToast } from "./Toast";
import {
  seedanceVideoDurations,
  seedanceVideoRatios,
  seedanceVideoResolutions,
  type VideoGenerationOptions,
  type VideoGenerationQuality,
} from "@/lib/video-options";

export interface GenerationModePanelProps {
  open: boolean;
  nodeId: string;
  panelData: {
    panelId: number;
    storyBeat: string;
    englishImagePrompt: string;
    chineseDirectorNotes?: string;
    cinematography?: Record<string, unknown>;
    firstFrame?: Record<string, string>;
    lastFrame?: Record<string, string>;
    characters?: string[];
    location?: string;
    props?: string[];
  };
  context: {
    characters: { name: string; appearance: string; outfit: string; referenceImage?: string }[];
    location: { name: string; description: string };
    props?: { name: string; description: string }[];
    artStyle: string;
  };
  onClose: () => void;
  /** 参考图持久化（IndexedDB，防刷新丢失）：初始值 + 变更回调 */
  persistedReferenceImages?: string[];
  onPersistReferenceImages?: (nodeId: string, images: string[]) => void;
  onGenerate: (
    mode: GenerationMode,
    prompt: string,
    referenceImages?: string[],
    options?: VideoGenerationOptions
  ) => void;
  isGenerating: boolean;
  existingImageUrl?: string;
  videoGenerationEnabled?: boolean;
}

// 模式图标映射
const modeIcons: Record<GenerationMode, typeof ImageIcon> = {
  "gpt-image2-storyboard": ImageIcon,
  "seedance-text-to-video": VideoIcon,
  "seedance-image-to-video": FileImage,
  "zzdh-text-to-video": VideoIcon,
  "zzdh-first-last-frame": Film,
  "zzdh-multi-reference": Images,
  "zzdh-multi-image-audio": Mic,
  "zzdh-lip-sync": Smile,
  "asset-reference-sheet": Layers,
};

// 模式颜色映射
const modeColors: Record<GenerationMode, string> = {
  "gpt-image2-storyboard": "text-violet-400",
  "seedance-text-to-video": "text-emerald-400",
  "seedance-image-to-video": "text-amber-400",
  "zzdh-text-to-video": "text-cyan-400",
  "zzdh-first-last-frame": "text-cyan-400",
  "zzdh-multi-reference": "text-cyan-400",
  "zzdh-multi-image-audio": "text-cyan-400",
  "zzdh-lip-sync": "text-cyan-400",
  "asset-reference-sheet": "text-pink-400",
};

// 模式背景色映射
const modeBgColors: Record<GenerationMode, string> = {
  "gpt-image2-storyboard": "bg-violet-500/10 border-violet-500/20",
  "seedance-text-to-video": "bg-emerald-500/10 border-emerald-500/20",
  "seedance-image-to-video": "bg-amber-500/10 border-amber-500/20",
  "zzdh-text-to-video": "bg-cyan-500/10 border-cyan-500/20",
  "zzdh-first-last-frame": "bg-cyan-500/10 border-cyan-500/20",
  "zzdh-multi-reference": "bg-cyan-500/10 border-cyan-500/20",
  "zzdh-multi-image-audio": "bg-cyan-500/10 border-cyan-500/20",
  "zzdh-lip-sync": "bg-cyan-500/10 border-cyan-500/20",
  "asset-reference-sheet": "bg-pink-500/10 border-pink-500/20",
};

export default function GenerationModePanel({
  open,
  nodeId,
  panelData,
  context,
  persistedReferenceImages,
  onPersistReferenceImages,
  onClose,
  onGenerate,
  isGenerating,
  existingImageUrl,
  videoGenerationEnabled = false,
}: GenerationModePanelProps) {
  const [selectedMode, setSelectedMode] = useState<GenerationMode | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillConfig | null>(null);
  const [viewMode, setViewMode] = useState<"skill" | "manual">("skill");
  const [generatedPrompt, setGeneratedPrompt] = useState<BuiltPrompt | null>(null);
  const [copied, setCopied] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>(persistedReferenceImages ?? []);
  const [referenceAudios, setReferenceAudios] = useState<string[]>([]);
  const [zzdhQuality, setZzdhQuality] = useState<"480p" | "768p">("480p");
  const [videoOptions, setVideoOptions] = useState<VideoGenerationOptions>({
    duration: 5,
    aspectRatio: "16:9",
    quality: "720p",
    generateAudio: true,
    watermark: false,
  });

  // 重置状态当面板打开时
  useEffect(() => {
    if (open) {
      setSelectedMode(null);
      setSelectedSkill(null);
      setViewMode("skill");
      setGeneratedPrompt(null);
      setReferenceImages([]);
      setReferenceAudios([]);
      setZzdhQuality("480p");
      setVideoOptions({
        duration: 5,
        aspectRatio: "16:9",
        quality: "720p",
        generateAudio: true,
        watermark: false,
      });
    }
  }, [open, nodeId]);

  // 构建 StoryboardPanel 数据
  const storyboardPanel = useMemo<StoryboardPanel>(() => {
    return {
      panelId: panelData.panelId,
      storyBeat: panelData.storyBeat,
      englishImagePrompt: panelData.englishImagePrompt,
      chineseDirectorNotes: panelData.chineseDirectorNotes || "",
      cinematography: {
        shotType: (panelData.cinematography?.shotType as ShotType) || "MS",
        focalLength: (panelData.cinematography?.focalLength as number) || 35,
        cameraHeight: (panelData.cinematography?.cameraHeight as CameraHeight) || "eye",
        depthOfField: (panelData.cinematography?.depthOfField as DepthOfField) || "medium",
        composition: (panelData.cinematography?.composition as Composition) || "rule_of_thirds",
        cameraMovement: (panelData.cinematography?.cameraMovement as CameraMovement) || "static",
        actionRhythm: (panelData.cinematography?.actionRhythm as ActionRhythm) || "floating",
        directorStyle: panelData.cinematography?.directorStyle as string,
        lighting: panelData.cinematography?.lighting as { keyLight: string; colorTemperature: string; mood: string },
        materialKeywords: panelData.cinematography?.materialKeywords as string[],
      },
      firstFrame: panelData.firstFrame,
      lastFrame: panelData.lastFrame,
      characters: panelData.characters || [],
      location: panelData.location,
      props: panelData.props,
    };
  }, [panelData]);

  // 当选择模式时生成提示词
  useEffect(() => {
    if (!selectedMode) {
      setGeneratedPrompt(null);
      return;
    }

    // 使用 StoryboardPromptBuilder 生成提示词
    const builder = new StoryboardPromptBuilder(storyboardPanel, {
      characters: context.characters,
      location: context.location,
      props: context.props,
      artStyle: context.artStyle,
    });

    try {
      const result = builder.build(selectedMode);
      setGeneratedPrompt(result);

      // 如果需要参考图，自动从已有资源获取
      if (result.requiresReferenceImages) {
        const refs: string[] = [];
        if (existingImageUrl) {
          refs.push(existingImageUrl);
        }
        // 添加角色参考图
        context.characters.forEach((char) => {
          if (char.referenceImage) {
            refs.push(char.referenceImage);
          }
        });
        setReferenceImages(refs);
      }
    } catch (error) {
      console.error("生成提示词失败:", error);
      showToast("error", "生成提示词失败");
    }
  }, [selectedMode, storyboardPanel, context, existingImageUrl]);

  // 处理模式选择
  const handleModeSelect = (mode: GenerationMode) => {
    setSelectedMode(mode);
  };

  // 处理 Skill 选择
  const handleSkillSelect = (skill: SkillConfig) => {
    setSelectedSkill(skill);
    setSelectedMode(skill.mode);

    // 自动填充视频参数
    if (skill.defaultOptions) {
      setVideoOptions((prev) => ({
        ...prev,
        duration: skill.defaultOptions.duration ?? prev.duration,
        aspectRatio: (skill.defaultOptions.aspectRatio as VideoGenerationOptions["aspectRatio"]) ?? prev.aspectRatio,
        quality: (skill.defaultOptions.quality as VideoGenerationQuality) ?? prev.quality,
        generateAudio: skill.defaultOptions.generateAudio ?? prev.generateAudio,
        watermark: skill.defaultOptions.watermark ?? prev.watermark,
      }));
    }

    // 设置 zzdh 质量
    if (skill.defaultOptions.quality === "480p" || skill.defaultOptions.quality === "768p") {
      setZzdhQuality(skill.defaultOptions.quality as "480p" | "768p");
    }
  };

  // 复制提示词
  const handleCopyPrompt = () => {
    if (!generatedPrompt?.prompt) return;
    navigator.clipboard.writeText(generatedPrompt.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast("success", "提示词已复制");
    });
  };

  // 执行生成
  const handleGenerate = () => {
    if (!selectedMode || !generatedPrompt) return;
    const isZzdh = selectedMode.startsWith("zzdh-");

    // 应用 Skill 的 prompt 前缀/后缀
    let finalPrompt = generatedPrompt.prompt;
    if (selectedSkill) {
      if (selectedSkill.promptPrefix) {
        finalPrompt = selectedSkill.promptPrefix + finalPrompt;
      }
      if (selectedSkill.promptSuffix) {
        finalPrompt = finalPrompt + selectedSkill.promptSuffix;
      }
    }

    onGenerate(
      selectedMode,
      finalPrompt,
      referenceImages,
      selectedModeConfig?.outputType === "video"
        ? {
            ...videoOptions,
            quality: isZzdh ? zzdhQuality : videoOptions.quality,
            aspectRatio: isZzdh ? (videoOptions.aspectRatio === "16:9" ? "horizontal" : "vertical") : videoOptions.aspectRatio,
            referenceAudios: isZzdh ? referenceAudios : undefined,
          }
        : undefined
    );
  };

  // 处理参考图上传
  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setReferenceImages((prev) => {
          const next = [...prev, base64];
          onPersistReferenceImages?.(nodeId, next);
          return next;
        });
        showToast("success", "参考图已上传");
      }
    };
    reader.readAsDataURL(file);
  };

  // 移除参考图
  const handleRemoveReferenceImage = (index: number) => {
    setReferenceImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onPersistReferenceImages?.(nodeId, next);
      return next;
    });
  };

  // 处理参考音频上传
  const handleReferenceAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setReferenceAudios((prev) => [...prev, base64]);
        showToast("success", "参考音频已上传");
      }
    };
    reader.readAsDataURL(file);
  };

  // 移除参考音频
  const handleRemoveReferenceAudio = (index: number) => {
    setReferenceAudios((prev) => prev.filter((_, i) => i !== index));
  };

  if (!open) return null;

  const selectedModeConfig = selectedMode
    ? GENERATION_MODE_OPTIONS.find((m) => m.value === selectedMode)
    : null;

  const ModeIcon = selectedMode ? modeIcons[selectedMode] : Sparkles;
  const modeColorClass = selectedMode ? modeColors[selectedMode] : "text-zinc-400";
  const modeBgClass = selectedMode ? modeBgColors[selectedMode] : "bg-zinc-900/60 border-zinc-800/60";
  const isVideoMode = selectedModeConfig?.outputType === "video";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700/50 bg-[#0f0f0f]/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/60 px-5 py-3.5 bg-[#0f0f0f]/95">
          <div className="flex items-center gap-2.5">
            <div className={`flex size-8 items-center justify-center rounded-lg ${modeBgClass}`}>
              <ModeIcon className={`size-4 ${modeColorClass}`} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-200">
                {selectedModeConfig ? selectedModeConfig.label : "选择生成模式"}
              </h3>
              <p className="text-[11px] text-zinc-500">
                分镜 #{panelData.panelId} · {panelData.storyBeat.slice(0, 20)}...
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Step 1: 选择生成模式 */}
          {!selectedMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="flex size-5 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-medium">
                    1
                  </span>
                  <span>选择生成方式</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("skill")}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      viewMode === "skill"
                        ? "bg-violet-500/20 text-violet-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    技能
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("manual")}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      viewMode === "manual"
                        ? "bg-violet-500/20 text-violet-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    手动
                  </button>
                </div>
              </div>

              {viewMode === "skill" ? (
                <SkillSelector
                  value={selectedSkill?.id ?? null}
                  onChange={handleSkillSelect}
                  size="md"
                />
              ) : (
                <GenerationModeSelector
                  value={selectedMode}
                  onChange={(mode) => handleModeSelect(mode)}
                  showDescriptions={true}
                  size="md"
                />
              )}

              {/* 分镜信息预览 */}
              <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 space-y-2">
                <h4 className="text-xs font-medium text-zinc-300">分镜信息</h4>
                <div className="text-[11px] text-zinc-500 space-y-1">
                  <p>
                    <span className="text-zinc-600">剧情:</span> {panelData.storyBeat}
                  </p>
                  <p>
                    <span className="text-zinc-600">角色:</span>{" "}
                    {panelData.characters?.join(", ") || context.characters.map((c) => c.name).join(", ") || "未指定"}
                  </p>
                  <p>
                    <span className="text-zinc-600">场景:</span> {panelData.location || context.location.name}
                  </p>
                  {!!panelData.cinematography?.shotType && (
                    <p>
                      <span className="text-zinc-600">镜头:</span> {String(panelData.cinematography.shotType)} ·{" "}
                      {String(panelData.cinematography.focalLength || "35")}mm · {String(panelData.cinematography.cameraMovement || "static")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 确认生成 */}
          {selectedMode && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  2
                </span>
                <span>确认生成设置</span>
              </div>

              {/* 模式信息卡片 */}
              <div className={`rounded-xl border ${modeBgClass} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ModeIcon className={`size-4 ${modeColorClass}`} />
                    <span className="text-sm font-medium text-zinc-200">
                      {selectedSkill ? selectedSkill.name : selectedModeConfig?.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedMode(null); setSelectedSkill(null); setViewMode("skill"); }}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
                  >
                    重新选择
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {selectedSkill ? selectedSkill.description : selectedModeConfig?.description}
                </p>
                {selectedSkill?.promptPrefix && (
                  <div className="mt-2 rounded-lg bg-zinc-900/60 px-2 py-1.5">
                    <span className="text-[9px] text-zinc-600">提示词前缀: </span>
                    <span className="text-[10px] text-cyan-400/80 font-mono">{selectedSkill.promptPrefix.slice(0, 60)}...</span>
                  </div>
                )}
              </div>

              {/* 参考图上传 (如果需要) */}
              {generatedPrompt?.requiresReferenceImages && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-3.5 text-amber-400" />
                    <span className="text-xs text-amber-400">此模式需要参考图</span>
                  </div>

                  {/* 参考图预览 */}
                  {referenceImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {referenceImages.map((img, index) => (
                        <div key={index} className="relative size-16 rounded-lg border border-zinc-700/50 overflow-hidden group">
                          <img src={img} alt={`参考 ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveReferenceImage(index)}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="size-3.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 上传按钮 */}
                  <label className="flex items-center gap-2 rounded-lg border border-zinc-700/50 border-dashed bg-zinc-900/40 px-3 py-2 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                    <FileImage className="size-4 text-zinc-500" />
                    <span className="text-xs text-zinc-500">点击上传参考图</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* 视频参数 */}
              {isVideoMode && (() => {
                const isZzdh = selectedMode?.startsWith("zzdh-");
                const needsAudio = selectedMode === "zzdh-multi-image-audio" || selectedMode === "zzdh-lip-sync";

                return (
                  <div className="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-950/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                        <Settings2 className="size-3.5 text-emerald-400" />
                        <span>{isZzdh ? "MiniMax H3 视频参数" : "Seedance 视频参数"}</span>
                      </div>
                      <span className="text-[10px] text-zinc-600">
                        {videoGenerationEnabled ? "将直接提交视频任务" : "未填视频 Key 时导出提示词"}
                      </span>
                    </div>

                    {/* 分辨率 */}
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-500">分辨率</div>
                      <div className={`grid ${isZzdh ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
                        {(isZzdh ? ["480p", "768p"] : seedanceVideoResolutions).map((quality) => (
                          <button
                            key={quality}
                            type="button"
                            onClick={() => {
                              if (isZzdh) {
                                setZzdhQuality(quality as "480p" | "768p");
                              } else {
                                setVideoOptions((prev) => ({ ...prev, quality: quality as VideoGenerationQuality }));
                              }
                            }}
                            className={`h-8 rounded-full border text-xs transition-colors ${
                              (isZzdh ? zzdhQuality : videoOptions.quality) === quality
                                ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                                : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                            }`}
                          >
                            {quality}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 比例 */}
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-500">比例</div>
                      <div className={`grid ${isZzdh ? "grid-cols-2" : "grid-cols-4"} gap-2`}>
                        {(isZzdh
                          ? [{ value: "horizontal", label: "横屏" }, { value: "vertical", label: "竖屏" }]
                          : seedanceVideoRatios
                        ).map((ratio) => (
                          <button
                            key={ratio.value}
                            type="button"
                            onClick={() => setVideoOptions((prev) => ({ ...prev, aspectRatio: ratio.value as never }))}
                            className={`flex h-12 flex-col items-center justify-center rounded-lg border text-[11px] transition-colors ${
                              videoOptions.aspectRatio === ratio.value
                                ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
                                : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                            }`}
                          >
                            <span>{ratio.label}</span>
                            <span className="text-[9px] opacity-60">{ratio.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 时长 */}
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-500">时长</div>
                      <div className="grid grid-cols-4 gap-2">
                        {(isZzdh ? [1, 3, 5, 10, 15] : seedanceVideoDurations).map((duration) => (
                          <button
                            key={duration}
                            type="button"
                            onClick={() => setVideoOptions((prev) => ({ ...prev, duration }))}
                            className={`h-8 rounded-full border text-xs transition-colors ${
                              videoOptions.duration === duration
                                ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
                                : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                            }`}
                          >
                            {duration === -1 ? "智能" : `${duration}s`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Seedance 特有选项 */}
                    {!isZzdh && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setVideoOptions((prev) => ({
                              ...prev,
                              generateAudio: !prev.generateAudio,
                            }))
                          }
                          className={`flex h-9 items-center justify-center gap-2 rounded-lg border text-xs transition-colors ${
                            videoOptions.generateAudio
                              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500"
                          }`}
                        >
                          <Volume2 className="size-3.5" />
                          生成声音
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVideoOptions((prev) => ({
                              ...prev,
                              watermark: !prev.watermark,
                            }))
                          }
                          className={`h-9 rounded-lg border text-xs transition-colors ${
                            videoOptions.watermark
                              ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500"
                          }`}
                        >
                          添加水印
                        </button>
                      </div>
                    )}

                    {/* 参考音频上传 (仅 zzdh 多图多音频/对口型) */}
                    {isZzdh && needsAudio && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Music className="size-3.5 text-cyan-400" />
                          <span className="text-[11px] text-zinc-500">参考音频</span>
                        </div>

                        {referenceAudios.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {referenceAudios.map((audio, index) => (
                              <div key={index} className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-1.5 group">
                                <Music className="size-3 text-cyan-400" />
                                <span className="text-[11px] text-zinc-400">音频 {index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReferenceAudio(index)}
                                  className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <label className="flex items-center gap-2 rounded-lg border border-zinc-700/50 border-dashed bg-zinc-900/40 px-3 py-2 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                          <Mic className="size-4 text-zinc-500" />
                          <span className="text-xs text-zinc-500">点击上传参考音频</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleReferenceAudioUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 生成的提示词预览 */}
              {generatedPrompt && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">
                      生成的提示词
                      {selectedSkill && <span className="text-violet-400 ml-1">(已应用 {selectedSkill.name})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {copied ? (
                        <>
                          <CheckCheck className="size-3 text-emerald-400" /> 已复制
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> 复制
                        </>
                      )}
                    </button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3">
                    <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedSkill?.promptPrefix && (
                        <span className="text-cyan-400/70">{selectedSkill.promptPrefix}</span>
                      )}
                      {generatedPrompt.prompt}
                      {selectedSkill?.promptSuffix && (
                        <span className="text-cyan-400/70">{selectedSkill.promptSuffix}</span>
                      )}
                    </pre>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span>比例: {generatedPrompt.aspectRatio}</span>
                    {isVideoMode && (
                      <>
                        <span>
                          时长: {videoOptions.duration === -1 ? "智能" : `${videoOptions.duration}s`}
                        </span>
                        <span>质量: {videoOptions.quality}</span>
                      </>
                    )}
                    {!isVideoMode && generatedPrompt.duration && <span>时长: {generatedPrompt.duration}s</span>}
                    {!isVideoMode && generatedPrompt.quality && <span>质量: {generatedPrompt.quality}</span>}
                  </div>
                </div>
              )}

              {/* 生成按钮 */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !generatedPrompt}
                className={`
                  w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium
                  transition-all duration-200 active:scale-[0.98]
                  ${
                    isGenerating || !generatedPrompt
                      ? "bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                      : selectedMode === "gpt-image2-storyboard"
                      ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                      : selectedMode === "seedance-text-to-video"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : selectedMode === "seedance-image-to-video"
                      ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                      : "bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20"
                  }
                `}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    {selectedModeConfig?.outputType === "video"
                      ? videoGenerationEnabled
                        ? selectedMode?.startsWith("zzdh-")
                          ? "生成视频 (MiniMax H3)"
                          : "生成视频"
                        : selectedMode?.startsWith("zzdh-")
                          ? "导出 MiniMax H3 提示词"
                          : "导出 Seedance 提示词"
                      : "生成图片"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
