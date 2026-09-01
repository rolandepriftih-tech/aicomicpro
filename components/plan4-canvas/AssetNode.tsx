"use client";

import { memo, useState, useRef, useEffect } from "react";
import { type NodeProps } from "@xyflow/react";
import { Loader2, Trash2, Image as ImageIcon, Upload, X, User, Lock, LockOpen } from "lucide-react";
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
  XyqHandle,
  IMAGE_TOOL_ITEMS,
} from "./XyqChrome";
import { Position } from "@xyflow/react";

export interface AssetNodeData {
  name: string;
  description: string;
  assetType: string;
  imageUrl?: string;
  referenceImage?: string;
  isGenerating?: boolean;
  generateStatus?: string;
  generateProgress?: number;
  consistencyLock?: boolean;
  consistencyPrompt?: string;
  aspectRatio?: string;
  onGenerate?: (id: string, prompt: string, referenceImages?: string[]) => void;
  onDescriptionChange?: (id: string, description: string) => void;
  onReferenceImageChange?: (id: string, image: string | null) => void;
  onEditImage?: (id: string) => void;
  onConsistencyLockChange?: (id: string, locked: boolean) => void;
  onDelete?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onAspectRatioChange?: (id: string, ratio: string) => void;
}

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

/**
 * 资产类型标签
 */
const ASSET_TYPE_LABELS: Record<string, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
  creature: "生物",
  cockpit: "座舱",
  custom: "自定义",
};

/**
 * AssetNode - 小云雀风格卡片（磨砂白卡 + 选中三件套）
 */
function AssetNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as AssetNodeData;
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

  const [localDesc, setLocalDesc] = useState(d.description || "");

  const isGenerating = d.isGenerating;
  const isCharacter = d.assetType === "character";
  const isLocked = d.consistencyLock;

  // 获取显示图片
  const displayImage = d.imageUrl || d.referenceImage;
  const hasImage = !!displayImage;

  // 同步节点数据
  useEffect(() => {
    if (d.description !== undefined) setLocalDesc(d.description);
  }, [d.description]);

  const handleGenerate = () => {
    if (!localDesc.trim() || isGenerating) return;
    d.onGenerate?.(id, localDesc, d.referenceImage ? [d.referenceImage] : undefined);
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
      {/* 选中工具条（小云雀 selectionToolbar：卡顶上方 28px，空卡禁用） */}
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

      {/* 类型标签（卡上方 12px 灰字） */}
      <NodeTypeTag label={ASSET_TYPE_LABELS[d.assetType] || "资产"} />

      {/* 卡面（磨砂白 + 三态描边） */}
      <CardShell selected={selected} style={{ width: 420, height: 315 }}>
        <div
          className={`relative flex h-full w-full items-center justify-center ${isGenerating ? "xyq-shimmer" : ""}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (hasImage) d.onEditImage?.(id);
            else setShowInputPanel(true);
          }}
        >
          {hasImage && displayImage ? (
            <ThumbnailImage src={displayImage} alt={d.name || "资产图片"} className="h-full w-full object-contain" />
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

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      </CardShell>

      {/* 卡下方 attached-label */}
      <AttachedLabel
        title={d.name || "未命名标题"}
        tag={isCharacter && isLocked ? "已锁定" : undefined}
        meta={hasImage ? "已生成" : "待补充"}
        onMore={() => setShowInputPanel(true)}
      />

      {/* 浮动输入面板（小云雀 composer 风格） */}
      {showInputPanel && (
        <div
          className="xyq-composer absolute left-1/2 top-full z-50 mt-3 w-[760px] -translate-x-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部：标题 + 功能钮 */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-black/45">{ASSET_TYPE_LABELS[d.assetType] || "资产"}描述</span>
            <div className="flex items-center gap-1">
              {isCharacter && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    d.onConsistencyLockChange?.(id, !isLocked);
                  }}
                  className={`rounded-full p-1.5 transition-colors ${
                    isLocked ? "bg-[#aa80ff]/10 text-[#8149f2]" : "text-black/45 hover:bg-black/5"
                  }`}
                  title={isLocked ? "解锁角色一致性" : "锁定角色一致性"}
                >
                  {isLocked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                </button>
              )}
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

          {/* 描述输入 */}
          <textarea
            value={localDesc}
            onChange={(e) => {
              setLocalDesc(e.target.value);
              d.onDescriptionChange?.(id, e.target.value);
            }}
            placeholder="描述这个资产的外观特征..."
            className="h-[180px] min-h-[120px]"
            rows={8}
          />

          {/* 参数行 + 生成 */}
          <div className="mt-2 flex items-center gap-2">
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
            {d.referenceImage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  d.onReferenceImageChange?.(id, null);
                  showToast("info", "参考图已清除");
                }}
                className="xyq-chip hover:!bg-red-500/10"
              >
                <X className="size-3" />
                <span>清除</span>
              </button>
            )}
            <div className="flex-1" />
            {d.generateStatus === "error" && <span className="text-xs text-red-500">生成失败</span>}
            <GenerateCircleButton disabled={!localDesc.trim()} generating={isGenerating} onClick={handleGenerate} />
          </div>
        </div>
      )}

      {/* 连接点：34px 磨砂圆 */}
      <XyqHandle type="target" position={Position.Left} id="left" />
      <XyqHandle type="source" position={Position.Right} id="right" />
    </div>
  );
}

export default memo(AssetNodeComponent);
