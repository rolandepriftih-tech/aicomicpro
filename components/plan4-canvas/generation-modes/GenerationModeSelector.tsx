"use client";

import { useState } from "react";
import {
  ImageIcon,
  VideoIcon,
  Grid3X3Icon,
  FileImageIcon,
  Check,
  Info,
  Film,
  Images,
  Mic,
  Smile,
} from "lucide-react";
import type { GenerationMode } from "@/lib/templates/storyboard-template";

export interface GenerationModeOption {
  value: GenerationMode;
  label: string;
  description: string;
  icon: React.ElementType;
  requiresRefImages: boolean;
  refImageTypes: ("character" | "scene" | "style")[];
  outputType: "image" | "video";
  recommendedFor: string[];
  templateStructure: string;
}

export const GENERATION_MODES: GenerationModeOption[] = [
  {
    value: "gpt-image2-storyboard",
    label: "分镜图 (GPT Image 2)",
    description: "生成专业电影分镜图，包含6模块视觉参考",
    icon: ImageIcon,
    requiresRefImages: false,
    refImageTypes: [],
    outputType: "image",
    recommendedFor: ["分镜预览", "场景设定", "视觉参考板"],
    templateStructure: "6模块: 场景概览/色彩DNA/关键分镜/角色站位/道具细节/光影参考",
  },
  {
    value: "seedance-text-to-video",
    label: "文生视频 (Seedance)",
    description: "填写视频 API Key 后生成视频，未配置时导出提示词",
    icon: VideoIcon,
    requiresRefImages: false,
    refImageTypes: [],
    outputType: "video",
    recommendedFor: ["快速原型", "概念验证", "动态预览"],
    templateStructure: "导演描述/主体动作/环境/运镜/光影/时长",
  },
  {
    value: "seedance-image-to-video",
    label: "图生视频 (Seedance)",
    description: "用当前图片/参考图生成视频，未配置时导出提示词",
    icon: FileImageIcon,
    requiresRefImages: true,
    refImageTypes: ["character", "scene"],
    outputType: "video",
    recommendedFor: ["角色动画", "场景运动", "保持角色一致性"],
    templateStructure: "参考图+文字描述/首尾帧控制/运镜/时长",
  },
  {
    value: "zzdh-text-to-video",
    label: "文生视频 (MiniMax H3)",
    description: "字字动画 MiniMax H3 文生视频，支持 480p/768p",
    icon: VideoIcon,
    requiresRefImages: false,
    refImageTypes: [],
    outputType: "video",
    recommendedFor: ["快速生成", "概念验证", "动态预览"],
    templateStructure: "文字描述/运镜/光影/时长",
  },
  {
    value: "zzdh-first-last-frame",
    label: "首尾帧 (MiniMax H3)",
    description: "首帧必填+尾帧可选，控制视频起止画面",
    icon: Film,
    requiresRefImages: true,
    refImageTypes: ["character", "scene"],
    outputType: "video",
    recommendedFor: ["转场效果", "角色动作", "场景过渡"],
    templateStructure: "首帧图+尾帧图+文字描述/运镜/时长",
  },
  {
    value: "zzdh-multi-reference",
    label: "多参考图生 (MiniMax H3)",
    description: "最多 19 张参考图，保持角色/场景一致性",
    icon: Images,
    requiresRefImages: true,
    refImageTypes: ["character", "scene"],
    outputType: "video",
    recommendedFor: ["角色一致性", "多角度展示", "复杂场景"],
    templateStructure: "多张参考图+文字描述/运镜/时长",
  },
  {
    value: "zzdh-multi-image-audio",
    label: "多图多音频 (MiniMax H3)",
    description: "最多 9 图 3 音频，口型和节奏跟随音频",
    icon: Mic,
    requiresRefImages: true,
    refImageTypes: ["character", "scene"],
    outputType: "video",
    recommendedFor: ["对话场景", "配音视频", "口型同步"],
    templateStructure: "参考图+参考音频+文字描述/时长",
  },
  {
    value: "zzdh-lip-sync",
    label: "对口型 (MiniMax H3)",
    description: "1 张图 + 1 条音频，精确口型同步",
    icon: Smile,
    requiresRefImages: true,
    refImageTypes: ["character"],
    outputType: "video",
    recommendedFor: ["角色对话", "唱歌", "口型动画"],
    templateStructure: "人脸图+音频/时长",
  },
  {
    value: "asset-reference-sheet",
    label: "资产设计表",
    description: "生成角色/场景/道具的完整设计参考表",
    icon: Grid3X3Icon,
    requiresRefImages: false,
    refImageTypes: [],
    outputType: "image",
    recommendedFor: ["角色设计", "场景设定", "道具设计", "一致性资产"],
    templateStructure: "角色:三视图+表情+服装 / 场景:俯视+透视+细节 / 道具:三视图+特写",
  },
];

export interface GenerationModeSelectorProps {
  value: GenerationMode | null;
  onChange: (mode: GenerationMode, config: GenerationModeOption) => void;
  availableModes?: GenerationMode[];
  showDescriptions?: boolean;
  size?: "sm" | "md" | "lg";
}

export function GenerationModeSelector({
  value,
  onChange,
  availableModes,
  showDescriptions = true,
  size = "md",
}: GenerationModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<GenerationMode | null>(null);

  const modes = availableModes
    ? GENERATION_MODES.filter((m) => availableModes.includes(m.value))
    : GENERATION_MODES;

  const sizeClasses = {
    sm: {
      container: "gap-2",
      card: "p-2 rounded-lg",
      icon: "w-6 h-6",
      title: "text-[10px]",
      desc: "text-[9px]",
    },
    md: {
      container: "gap-3",
      card: "p-3 rounded-xl",
      icon: "w-8 h-8",
      title: "text-xs",
      desc: "text-[10px]",
    },
    lg: {
      container: "gap-4",
      card: "p-4 rounded-2xl",
      icon: "w-10 h-10",
      title: "text-sm",
      desc: "text-xs",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className={`grid grid-cols-2 ${classes.container}`}>
      {modes.map((mode) => {
        const isSelected = value === mode.value;
        const _isHovered = hoveredMode === mode.value;
        const Icon = mode.icon;

        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value, mode)}
            onMouseEnter={() => setHoveredMode(mode.value)}
            onMouseLeave={() => setHoveredMode(null)}
            className={`
              ${classes.card} relative text-left transition-all duration-200
              ${
                isSelected
                  ? "bg-violet-500/20 border-2 border-violet-500/60 shadow-lg shadow-violet-500/10"
                  : "bg-zinc-900/60 border border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700/60"
              }
            `}
          >
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2">
                <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            )}

            {/* Icon */}
            <div className={`${classes.icon} rounded-lg bg-zinc-800/80 flex items-center justify-center mb-2`}>
              <Icon className="w-4 h-4 text-zinc-400" />
            </div>

            {/* Title */}
            <h4 className={`${classes.title} font-medium text-zinc-200 mb-0.5`}>
              {mode.label}
            </h4>

            {/* Description */}
            {showDescriptions && (
              <p className={`${classes.desc} text-zinc-500 leading-relaxed`}>
                {mode.description}
              </p>
            )}

            {/* Reference image indicator */}
            {mode.requiresRefImages && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400/80">
                <Info className="w-3 h-3" />
                需要参考图
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default GenerationModeSelector;
