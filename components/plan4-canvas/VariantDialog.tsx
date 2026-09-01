"use client";

import { useState, useCallback } from "react";
import {
  X,
  Wand2,
  Loader2,
  Check,
} from "lucide-react";
import { showToast } from "./Toast";

interface VariantDialogProps {
  open: boolean;
  imageUrl: string;
  originalPrompt: string;
  onClose: () => void;
  onGenerate: (count: number, referenceImage: string, prompt: string) => Promise<string[]>;
  onSelect: (url: string) => void;
}

export default function VariantDialog({
  open,
  imageUrl,
  originalPrompt,
  onClose,
  onGenerate,
  onSelect,
}: VariantDialogProps) {
  const [count, setCount] = useState<1 | 2 | 4>(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setVariants([]);
    setSelectedIdx(null);
    try {
      const urls = await onGenerate(count, imageUrl, originalPrompt);
      setVariants(urls);
      if (urls.length === 0) {
        showToast("error", "未生成变体");
      }
    } catch {
      showToast("error", "变体生成失败");
    } finally {
      setIsGenerating(false);
    }
  }, [count, imageUrl, originalPrompt, isGenerating, onGenerate]);

  const handleConfirm = () => {
    if (selectedIdx !== null && variants[selectedIdx]) {
      onSelect(variants[selectedIdx]);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-[640px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-[#1a1a1a]/98 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/40 px-5 py-3">
          <span className="text-sm font-semibold text-zinc-200">生成变体</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Controls */}
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">数量</span>
            {[1, 2, 4].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c as 1 | 2 | 4)}
                className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                  count === c
                    ? "border-violet-500/40 bg-violet-950/30 text-violet-300"
                    : "border-zinc-800/60 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700/60 hover:text-zinc-300"
                }`}
              >
                {c}x
              </button>
            ))}
            <div className="flex-1" />
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black shadow-lg shadow-white/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              {isGenerating ? "生成中..." : "生成变体"}
            </button>
          </div>

          {/* Original */}
          <div className="mb-4">
            <div className="mb-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">原图</div>
            <img
              src={imageUrl}
              alt="original"
              className="h-32 w-auto rounded-xl border border-zinc-800/40 object-contain"
            />
          </div>

          {/* Variants grid */}
          {variants.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">变体结果</div>
              <div className={`grid gap-3 ${variants.length === 1 ? "grid-cols-1" : variants.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
                {variants.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`relative overflow-hidden rounded-xl border transition-all ${
                      selectedIdx === idx
                        ? "border-emerald-500/60 ring-2 ring-emerald-500/30"
                        : "border-zinc-800/40 hover:border-zinc-600/40"
                    }`}
                  >
                    <img src={url} alt={`variant-${idx}`} className="h-40 w-full object-cover" />
                    {selectedIdx === idx && (
                      <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg">
                        <Check className="size-3.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {variants.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-800/40 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              disabled={selectedIdx === null}
              onClick={handleConfirm}
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-white/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              使用选中变体
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
