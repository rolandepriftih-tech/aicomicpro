"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { Loader2, Trash2, Image as ImageIcon, Upload, X } from "lucide-react";
import { showToast } from "./Toast";
import ThumbnailImage from "./ThumbnailImage";
import { handleImageToolClick } from "./ImageToolbar";
import {
  AttachedLabel,
  CardShell,
  EmptyCardActions,
  GenerateCircleButton,
  NodeTypeTag,
  SelectionToolbar,
  XyqChipDropdown,
  XyqHandle,
  IMAGE_TOOL_ITEMS,
} from "./XyqChrome";

/**
 * 压缩图片并转为 base64
 */
function compressToBase64(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img") as HTMLImageElement;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建 canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface PanelNodeData {
  panelId: number;
  storyBeat: string;
  englishImagePrompt: string;
  chineseDirectorNotes?: string;
  imageUrl?: string;
  referenceImage?: string;
  videoUrl?: string;
  previewUrl?: string;
  promptExportUrl?: string;
  generationOutputType?: "image" | "video" | "prompt-export";
  isGenerating?: boolean;
  generateStatus?: string;
  generateProgress?: number;
  aspectRatio?: string;
  onGenerate?: (id: string, prompt: string, referenceImages?: string[]) => void;
  onPromptChange?: (id: string, prompt: string) => void;
  onReferenceImageChange?: (id: string, referenceImage: string) => void;
  onEditImage?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onAspectRatioChange?: (id: string, ratio: string) => void;
  onOpenGenerationMode?: (id: string) => void;
}

/**
 * 根据比例计算卡片尺寸（小云雀规格：卡面 4:3=420×315 / 16:9=420×236 / 9:16=234×416 / 1:1=315×315）
 */
function getCardSize(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
    case "vertical":
      return { width: 234, height: 416 };
    case "16:9":
    case "horizontal":
      return { width: 420, height: 236 };
    case "1:1":
      return { width: 315, height: 315 };
    case "4:3":
    default:
      return { width: 420, height: 315 };
  }
}

/**
 * 比例选项
 */
const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9 横屏" },
  { value: "9:16", label: "9:16 竖屏" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
];

/**
 * PanelNode - 小云雀风格分镜卡（磨砂白卡 + 选中三件套）
 */
function PanelNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as PanelNodeData;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const [localPrompt, setLocalPrompt] = useState(d.englishImagePrompt || "");
  const [aspectRatio, setAspectRatio] = useState(d.aspectRatio || "16:9");

  const isGenerating = d.isGenerating;
  // 显示图：生成图优先，否则用上传的参考图（referenceImage）
  const displayImage = d.imageUrl || d.referenceImage;
  const hasImage = !!displayImage;
  const hasVideo = !!d.videoUrl;

  // 同步节点数据
  useEffect(() => {
    if (d.englishImagePrompt !== undefined) setLocalPrompt(d.englishImagePrompt);
    if (d.aspectRatio !== undefined) setAspectRatio(d.aspectRatio);
  }, [d.englishImagePrompt, d.aspectRatio]);

  // 根据比例计算卡片尺寸
  const cardSize = getCardSize(aspectRatio);

  const handleGenerate = () => {
    if (!localPrompt.trim() || isGenerating) return;
    d.onGenerate?.(id, localPrompt);
    setShowInputPanel(false);
  };

  // 上传图片
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressToBase64(file, 1024, 0.8);
      d.onReferenceImageChange?.(id, base64);
      showToast("success", "参考图已上传");
    } catch (err) {
      console.error("压缩参考图失败:", err);
      showToast("error", "参考图上传失败");
    }
    e.target.value = "";
  };

  return (
    <div ref={rootRef} className="xyq-node-enter relative">
      {/* 选中工具条（空卡禁用，小云雀行为） */}
      <SelectionToolbar
        visible={selected}
        tools={IMAGE_TOOL_ITEMS}
        disabled={!hasImage}
        onTool={(toolId) => {
          const tool = IMAGE_TOOL_ITEMS.find((t) => t.id === toolId);
          if (tool) handleImageToolClick(tool.label);
        }}
        onMore={() => setShowInputPanel(true)}
      />

      {/* 类型标签 */}
      <NodeTypeTag label="分镜" />

      {/* 卡面 */}
      <CardShell selected={selected} style={{ width: cardSize.width, height: cardSize.height }}>
        <div
          className={`relative flex h-full w-full items-center justify-center ${isGenerating ? "xyq-shimmer" : ""}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (hasImage) d.onEditImage?.(id);
            else setShowInputPanel(true);
          }}
        >
          {hasImage && displayImage ? (
            <ThumbnailImage src={displayImage} alt={`分镜 #${d.panelId}`} className="h-full w-full object-contain" />
          ) : hasVideo ? (
            <video
              src={d.previewUrl || d.videoUrl}
              controls
              className="h-full w-full object-contain"
              title={d.previewUrl ? "低清预览" : "视频预览"}
              onClick={(e) => e.stopPropagation()}
            />
          ) : isGenerating ? (
            <div className="flex flex-col items-center gap-2 text-black/40">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-xs">生成中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ImageIcon className="size-11 text-black/15" strokeWidth={1.5} />
              <EmptyCardActions
                onUpload={handleUploadClick}
                onLibrary={() => window.dispatchEvent(new CustomEvent("open-asset-library"))}
              />
            </div>
          )}

          {/* 替换图片快捷钮（有图时） */}
          {hasImage && !isGenerating && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleUploadClick();
              }}
              className="absolute left-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-black/45 shadow-sm backdrop-blur transition-colors hover:text-black/80"
              title="替换图片"
            >
              <Upload className="size-3.5" />
            </button>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      </CardShell>

      {/* attached-label：标题 = 分镜号 + 剧情拍点 */}
      <AttachedLabel
        title={d.storyBeat || `分镜 #${d.panelId}`}
        tag={`#${d.panelId}`}
        meta={hasVideo ? "已生成视频" : hasImage ? "已生成" : "待补充"}
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
            <span className="text-xs text-black/45">分镜 #{d.panelId} 提示词</span>
            <div className="flex items-center gap-1">
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
            placeholder="描述这个分镜的画面内容..."
            className="h-[180px] min-h-[120px]"
            rows={8}
          />

          {/* 参数行 + 生成 */}
          <div className="mt-2 flex items-center gap-2">
            <XyqChipDropdown
              label="画面比例"
              value={aspectRatio}
              options={ASPECT_RATIO_OPTIONS}
              onChange={(v) => {
                setAspectRatio(v);
                d.onAspectRatioChange?.(id, v);
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleUploadClick();
              }}
              className="xyq-chip"
            >
              <Upload className="size-3" />
              <span>{d.referenceImage ? "更换参考图" : "上传参考图"}</span>
            </button>
            <div className="flex-1" />
            {d.generateStatus === "error" && <span className="text-xs text-red-500">生成失败</span>}
            <GenerateCircleButton
              disabled={!localPrompt.trim()}
              generating={isGenerating}
              onClick={handleGenerate}
              title="智能生成"
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

export default memo(PanelNodeComponent);
