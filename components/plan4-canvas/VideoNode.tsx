"use client";

import { memo, useState, useMemo, useRef, useEffect } from "react";
import { Position, type NodeProps, useEdges } from "@xyflow/react";
import { Loader2, Trash2, Film, Upload, X } from "lucide-react";
import {
  VIDEO_KIND_LABELS,
  VIDEO_ENGINE_LABELS,
  type VideoGenerationKind,
  type VideoEngine,
} from "@/lib/video-gen";
import PromptPolishButton from "./PromptPolishButton";
import { showToast } from "./Toast";
import {
  AttachedLabel,
  CardShell,
  EmptyCardActions,
  GenerateCircleButton,
  NodeTypeTag,
  SelectionToolbar,
  XyqChipDropdown,
  XyqHandle,
  VIDEO_TOOL_ITEMS,
} from "./XyqChrome";

// 生成方式列表
const VIDEO_KINDS: VideoGenerationKind[] = [
  "text-to-video",
  "image-to-video",
  "first-last-frame",
  "multi-reference",
  "multi-image-audio",
  "lip-sync",
];

// 引擎列表
const VIDEO_ENGINES: VideoEngine[] = ["autodl", "ark", "zizidonghua"];

// 分辨率选项
const RESOLUTIONS = [
  { value: "480p竖", label: "480p 竖屏" },
  { value: "480p横", label: "480p 横屏" },
  { value: "768p竖", label: "768p 竖屏" },
  { value: "768p横", label: "768p 横屏" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

// 时长选项
const DURATION_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// 比例选项
const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9 横屏" },
  { value: "9:16", label: "9:16 竖屏" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
];

export interface VideoNodeData {
  prompt: string;
  kind?: VideoGenerationKind;
  engine?: VideoEngine;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  generateStatus?: "idle" | "generating" | "done" | "error";
  videoUrl?: string;
  previewUrl?: string;
  error?: string;
  onGenerate?: (id: string, engine: VideoEngine, kind: VideoGenerationKind, prompt: string, connectedPanelIds?: string[], audioBase64?: string, options?: { duration?: number; resolution?: string; aspectRatio?: string }) => void;
  onDelete?: (id: string) => void;
  onPromptChange?: (id: string, prompt: string) => void;
  onImportVideo?: (id: string, videoUrl: string, previewUrl: string) => void;
  onRefetchVideoUrl?: (nodeId: string) => void;
  /** 文本引擎配置（润色用） */
  textApiKey?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textBaseUrl?: string;
}

/**
 * 根据比例计算卡片尺寸（小云雀规格）
 */
function getCardSize(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
    case "vertical":
      return { width: 234, height: 416 };
    case "16:9":
    case "horizontal":
      return { width: 420, height: 236 };
    case "4:3":
      return { width: 420, height: 315 };
    case "1:1":
    default:
      return { width: 315, height: 315 };
  }
}

/**
 * VideoNode - 小云雀风格视频卡（磨砂白卡 + 选中三件套）
 */
function VideoNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as VideoNodeData;
  const edges = useEdges();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [showInputPanel, setShowInputPanel] = useState(false);
  // 选中卡片 → 下方展开输入区；取消选中 → 收起
  useEffect(() => {
    setShowInputPanel(selected);
  }, [selected]);

  // 点击本节点/工具条之外 → 收起浮动面板
  useEffect(() => {
    if (!showInputPanel) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current && !rootRef.current.contains(target) && !(target as Element).closest?.(".xyq-toolbar-wrap")) {
        setShowInputPanel(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showInputPanel]);

  const [localPrompt, setLocalPrompt] = useState(d.prompt || "");
  const [selectedKind, setSelectedKind] = useState<VideoGenerationKind>(d.kind || "text-to-video");
  const [selectedEngine, setSelectedEngine] = useState<VideoEngine>(d.engine || "autodl");
  const [duration, setDuration] = useState(d.duration || 5);
  const [resolution, setResolution] = useState(d.resolution || "768p竖");
  const [aspectRatio, setAspectRatio] = useState(d.aspectRatio || "16:9");

  const isGenerating = d.generateStatus === "generating";
  const hasVideo = !!d.videoUrl;

  // 同步节点数据
  useEffect(() => {
    if (d.prompt !== undefined) setLocalPrompt(d.prompt);
    if (d.kind !== undefined) setSelectedKind(d.kind);
    if (d.engine !== undefined) setSelectedEngine(d.engine);
    if (d.duration !== undefined) setDuration(d.duration);
    if (d.resolution !== undefined) setResolution(d.resolution);
    if (d.aspectRatio !== undefined) setAspectRatio(d.aspectRatio);
  }, [d.prompt, d.kind, d.engine, d.duration, d.resolution, d.aspectRatio]);

  // 计算关联的节点
  const connectedPanels = useMemo(() => {
    const panelIds: string[] = [];
    for (const edge of edges) {
      if (edge.source === id && (edge.target.startsWith("panel-") || edge.target.startsWith("asset-"))) {
        panelIds.push(edge.target);
      }
      if (edge.target === id && (edge.source.startsWith("panel-") || edge.source.startsWith("asset-"))) {
        panelIds.push(edge.source);
      }
    }
    return panelIds;
  }, [edges, id]);

  // 根据比例计算卡片尺寸
  const cardSize = getCardSize(aspectRatio);

  const handleGenerate = () => {
    if (!localPrompt.trim() || isGenerating) return;
    // 传递参数：id, engine, kind, prompt, connectedPanelIds, audioBase64, options
    d.onGenerate?.(
      id,
      selectedEngine,
      selectedKind,
      localPrompt,
      connectedPanels.length > 0 ? connectedPanels : undefined,
      undefined, // audioBase64
      { duration, resolution, aspectRatio }
    );
    setShowInputPanel(false);
  };

  // 导入视频
  const handleImportVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        videoUrl?: string;
        previewUrl?: string;
        error?: string;
      };

      if (res.ok && data.success && data.videoUrl) {
        d.onImportVideo?.(id, data.videoUrl, data.previewUrl || data.videoUrl);
      } else {
        alert(data.error || "导入失败");
      }
    } catch (err) {
      console.error("[VideoNode] 导入视频失败:", err);
      alert("导入失败，请重试");
    }

    e.target.value = "";
  };

  return (
    <div ref={rootRef} className="xyq-node-enter relative">
      {/* 选中工具条（视频组，空卡禁用） */}
      <SelectionToolbar
        visible={selected}
        tools={VIDEO_TOOL_ITEMS}
        disabled={!hasVideo}
        onTool={(toolId) => {
          // 视频工具暂为占位，接入时替换
          const tool = VIDEO_TOOL_ITEMS.find((t) => t.id === toolId);
          if (tool) showToast("info", `「${tool.label}」功能开发中`);
        }}
        onMore={() => setShowInputPanel(true)}
      />

      {/* 类型标签 */}
      <NodeTypeTag label="视频" />

      {/* 卡面 */}
      <CardShell selected={selected} style={{ width: cardSize.width, height: cardSize.height }}>
        <div
          className={`relative flex h-full w-full items-center justify-center ${isGenerating ? "xyq-shimmer" : ""}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setShowInputPanel(true);
          }}
        >
          {hasVideo ? (
            <video
              src={d.previewUrl || d.videoUrl}
              controls
              className="h-full w-full object-contain"
              title={d.previewUrl ? "低清预览（原片请点击下载）" : "视频预览"}
              onClick={(e) => e.stopPropagation()}
            />
          ) : isGenerating ? (
            <div className="flex flex-col items-center gap-2 text-black/40">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-xs">生成中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Film className="size-11 text-black/15" strokeWidth={1.5} />
              <EmptyCardActions
                onUpload={() => fileInputRef.current?.click()}
                onLibrary={() => window.dispatchEvent(new CustomEvent("open-asset-library"))}
              />
            </div>
          )}

          {hasVideo && d.previewUrl && (
            <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur">
              预览
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            className="hidden"
            onChange={handleImportVideo}
          />
        </div>
      </CardShell>

      {/* attached-label */}
      <AttachedLabel
        title="未命名视频"
        tag={connectedPanels.length > 0 ? `已连 ${connectedPanels.length}` : undefined}
        meta={hasVideo ? "已生成" : "待补充"}
        onMore={() => setShowInputPanel(true)}
      />

      {/* 浮动输入面板（composer） */}
      {showInputPanel && (
        <div
          className="xyq-composer absolute left-1/2 top-full z-50 mt-3 w-[760px] -translate-x-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-black/45">视频生成</span>
            <div className="flex items-center gap-1">
              <PromptPolishButton
                prompt={localPrompt}
                onPolished={(polished) => {
                  setLocalPrompt(polished);
                  d.onPromptChange?.(id, polished);
                }}
                disabled={isGenerating}
                textApiKey={d.textApiKey}
                textProvider={d.textProvider}
                textModel={d.textModel}
                textBaseUrl={d.textBaseUrl}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  d.onDelete?.(id);
                }}
                className="rounded-full p-1.5 text-black/45 transition-colors hover:bg-red-500/10 hover:text-red-500"
                title="删除节点"
              >
                <Trash2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowInputPanel(false)}
                className="rounded-full p-1.5 text-black/45 transition-colors hover:bg-black/5"
                title="收起"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* 提示词输入 */}
          <textarea
            value={localPrompt}
            onChange={(e) => {
              setLocalPrompt(e.target.value);
              d.onPromptChange?.(id, e.target.value);
            }}
            placeholder="描述你想要生成的视频内容，@引用素材"
            className="h-[180px] min-h-[120px]"
            rows={8}
          />

          {/* 参数行 + 生成 */}
          <div className="mt-2 flex items-center gap-2">
            <XyqChipDropdown
              label="生成方式"
              value={selectedKind}
              options={VIDEO_KINDS.map((k) => ({ value: k, label: VIDEO_KIND_LABELS[k] }))}
              onChange={(v) => setSelectedKind(v as VideoGenerationKind)}
            />
            <XyqChipDropdown
              label="引擎"
              value={selectedEngine}
              options={VIDEO_ENGINES.map((e) => ({ value: e, label: VIDEO_ENGINE_LABELS[e] }))}
              onChange={(v) => setSelectedEngine(v as VideoEngine)}
            />
            <XyqChipDropdown
              label="比例"
              value={aspectRatio}
              options={ASPECT_RATIO_OPTIONS}
              onChange={setAspectRatio}
            />
            <XyqChipDropdown
              label="时长"
              value={`${duration}s`}
              options={DURATION_OPTIONS.map((dur) => ({ value: `${dur}s`, label: `${dur}s` }))}
              onChange={(v) => setDuration(Number(v.replace("s", "")))}
            />
            <XyqChipDropdown label="分辨率" value={resolution} options={RESOLUTIONS} onChange={setResolution} />
            <div className="flex-1" />
            {d.generateStatus === "error" && d.error && (
              <span className="max-w-[200px] truncate text-xs text-red-500">{d.error}</span>
            )}
            <GenerateCircleButton
              disabled={!localPrompt.trim()}
              generating={isGenerating}
              onClick={handleGenerate}
              title={hasVideo ? "重新生成" : "生成"}
            />
          </div>
        </div>
      )}

      {/* 连接点：34px 磨砂圆 */}
      <XyqHandle type="target" position={Position.Left} id="left" />
      <XyqHandle type="source" position={Position.Right} id="right" />
    </div>
  );
}

/** 视频工具占位提示已内联到 onTool；接入真实功能后替换。 */

export default memo(VideoNodeComponent);
