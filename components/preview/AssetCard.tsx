"use client";

import { useState, useRef, useEffect } from "react";
import { Clapperboard, ArrowRight } from "lucide-react";

interface AssetCardProps {
  name: string;
  typeLabel: string;
  description: string;
  imageUrl?: string;
  referenceImage?: string;
  onGenerateImage?: (assetName: string, prompt: string, referenceImage?: string) => void;
  isGenerating?: boolean;
  onDescriptionChange?: (description: string) => void;
  onReferenceImageChange?: (image: string | null) => void;
  onRefineAsset?: (assetName: string, instruction: string) => Promise<string>;
  detailBlocks?: { title: string; body: string }[];
  referencedByPanels?: number[];
  onJumpToStoryboard?: (panelIds: number[]) => void;
}

/**
 * 资产卡片组件 - 展示单个资产的图片和描述
 * 从 PreviewPanel.tsx 内联实现提取，保持行为一致
 */
export function AssetCard({
  name,
  typeLabel,
  description,
  imageUrl,
  referenceImage,
  onGenerateImage,
  isGenerating,
  onDescriptionChange,
  onReferenceImageChange,
  onRefineAsset,
  detailBlocks,
  referencedByPanels,
  onJumpToStoryboard,
}: AssetCardProps) {
  const [localDesc, setLocalDesc] = useState(description);
  const [copied, setCopied] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalDesc(description);
  }, [description]);

  const handleCopy = () => {
    if (!localDesc) return;
    void navigator.clipboard.writeText(localDesc).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 统一计算当前展示的图片：如果有参考图，则优先展示参考图，否则展示 AI 生图
  const displayUrl = referenceImage || imageUrl;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const compressToBase64 = (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressToBase64(file, 1024, 0.8);
      onReferenceImageChange?.(base64);
    } catch (err) {
      console.error("压缩参考图失败:", err);
    }
  };

  const handleClearReference = () => {
    onReferenceImageChange?.(null);
  };

  const handleRefine = async () => {
    const instr = refineInstruction.trim();
    if (!instr) return;
    if (!onRefineAsset) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const newDesc = await onRefineAsset(name, instr);
      setLocalDesc(newDesc);
      onDescriptionChange?.(newDesc);
      setRefineInstruction("");
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : "改写失败");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <article className="animate-card-enter rounded-xl border border-zinc-700/80 bg-zinc-800/80 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-violet-500/10">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-700/60 px-4 py-2.5">
        <span className="truncate font-medium text-zinc-200">{name}</span>
        <span className="shrink-0 rounded bg-zinc-700/80 px-2 py-0.5 text-xs text-zinc-400">
          {typeLabel}
        </span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-zinc-600/80 bg-zinc-900/60 text-sm text-zinc-500">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>等待定妆</span>
          )}
        </div>
        <div className="relative mb-3">
          <div className="mb-1.5 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              {copied ? "已复制 ✓" : "复制描述"}
            </button>
          </div>
          <textarea
            value={localDesc}
            onChange={(e) => {
              const value = e.target.value;
              setLocalDesc(value);
              onDescriptionChange?.(value);
            }}
            placeholder="资产视觉描述（可编辑，不会影响后端原始结果，仅作为临时笔记）"
            className="w-full min-h-[8rem] resize-y rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3 text-sm text-zinc-300 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 [scrollbar-color:theme(colors.zinc.600)_transparent] [scrollbar-width:thin]"
          />
        </div>

        {/* Copilot 资产描述智能改写 */}
        {onRefineAsset && (
          <div className="mb-3 space-y-2 rounded-lg border border-zinc-700/80 bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                🤖 Copilot 改写描述
              </span>
            </div>
            <textarea
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              placeholder="例如：把衣服改成红色战甲；增加发光纹身；换成赛博朋克风格..."
              className="w-full resize-y rounded-md border border-zinc-700/70 bg-zinc-950/70 p-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/60"
              rows={2}
            />
            <div className="flex items-center justify-between gap-2">
              {refineError && (
                <p className="flex-1 text-[11px] text-red-400">
                  {refineError}
                </p>
              )}
              <button
                type="button"
                onClick={handleRefine}
                disabled={isRefining}
                className="shrink-0 rounded-md border border-amber-500/60 bg-amber-600/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-600/50 disabled:pointer-events-none disabled:opacity-60"
              >
                {isRefining ? "改写中…" : "✨ Copilot 改写"}
              </button>
            </div>
          </div>
        )}

        {detailBlocks && detailBlocks.length > 0 && (
          <div className="mb-3 space-y-2 border-t border-zinc-800/80 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              细分状态 / 变体（分析生成）
            </span>
            {detailBlocks.map((block, idx) => (
              <div
                key={`${block.title}-${idx}`}
                className="rounded-lg border border-zinc-700/50 bg-black/25 px-3 py-2"
              >
                <div className="mb-1 text-[11px] font-semibold text-violet-300/90">
                  {block.title}
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {block.body}
                </p>
              </div>
            ))}
          </div>
        )}
        {/* 分镜引用标签 */}
        {referencedByPanels && referencedByPanels.length > 0 && onJumpToStoryboard && (
          <button
            type="button"
            onClick={() => onJumpToStoryboard(referencedByPanels)}
            className="mb-3 flex w-full items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/50 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-violet-500/40 hover:text-violet-300"
          >
            <Clapperboard className="size-3.5 shrink-0 text-violet-400/70" />
            <span>被 {referencedByPanels.length} 个分镜引用</span>
            <ArrowRight className="ml-auto size-3 shrink-0 opacity-50" />
          </button>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {referenceImage ? (
              <button
                type="button"
                onClick={handleClearReference}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800/80 py-2 text-xs font-medium text-zinc-400 hover:border-red-500/50 hover:text-red-300"
              >
                🗑️ 清除参考
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUploadClick}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800/80 py-2 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
              >
                📤 上传参考
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => onGenerateImage?.(name, localDesc, referenceImage)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-500/50 bg-violet-950/40 py-2 text-xs font-medium text-violet-300 hover:border-violet-500/70 hover:bg-violet-950/60 disabled:pointer-events-none disabled:opacity-60"
          >
            {isGenerating ? "生成中…" : referenceImage ? "✨ AI 参考生成" : "✨ AI 盲盒生成"}
          </button>
        </div>
      </div>
    </article>
  );
}
