"use client";

import { useState, useCallback } from "react";
import {
  X,
  Wand2,
  Loader2,
  Shirt,
  Smile,
  MapPin,
  PersonStanding,
} from "lucide-react";
import { showToast } from "./Toast";
import { IMAGE_TOOLS, handleImageToolClick } from "./ImageToolbar";

interface ImageEditDialogProps {
  open: boolean;
  imageUrl: string;
  originalPrompt: string;
  onClose: () => void;
  onGenerate: (instruction: string, referenceImage: string) => Promise<string | undefined>;
}

const quickTags = [
  { label: "改变服装颜色", icon: Shirt, instruction: "Change the clothing color while keeping the same outfit style and design" },
  { label: "改变姿势", icon: PersonStanding, instruction: "Change the character's pose while maintaining the same overall composition and art style" },
  { label: "改变表情", icon: Smile, instruction: "Change the facial expression while keeping the same character features and art style" },
  { label: "改变背景", icon: MapPin, instruction: "Change the background scene while keeping the original subject in the same position and art style" },
];

export default function ImageEditDialog({
  open,
  imageUrl,
  originalPrompt: _originalPrompt,
  onClose,
  onGenerate,
}: ImageEditDialogProps) {
  const [instruction, setInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!instruction.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const url = await onGenerate(instruction.trim(), imageUrl);
      if (url) {
        showToast("success", "图片编辑完成");
        onClose();
      }
    } catch {
      showToast("error", "图片编辑失败");
    } finally {
      setIsGenerating(false);
    }
  }, [instruction, isGenerating, imageUrl, onGenerate, onClose]);

  const handleTagClick = (tagInstruction: string) => {
    setInstruction(tagInstruction);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-[720px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-[#1a1a1a]/98 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/40 px-5 py-3">
          <span className="text-sm font-semibold text-zinc-200">编辑图片</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 图片功能工具条 - 横贯整条（参考小云雀） */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800/40 bg-zinc-950/40 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {IMAGE_TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => handleImageToolClick(tool.label)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-white"
              title={tool.label}
            >
              <span className="text-sm leading-none">{tool.icon}</span>
              <span className="whitespace-nowrap">{tool.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => showToast("info", "更多功能开发中")}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200"
            title="更多"
          >
            <span className="text-sm leading-none">⋯</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Image preview */}
          <div className="flex flex-1 items-center justify-center bg-zinc-950/50 p-4">
            <img
              src={imageUrl}
              alt="preview"
              className="max-h-[60vh] max-w-full rounded-xl border border-zinc-800/40 object-contain shadow-lg"
            />
          </div>

          {/* Right: Controls */}
          <div className="flex w-[280px] flex-col border-l border-zinc-800/40 p-4">
            <div className="mb-3 text-[10px] text-zinc-500 uppercase tracking-wider">修改指令</div>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none [scrollbar-color:theme(colors.zinc.700)_transparent] [scrollbar-width:thin]"
              placeholder="描述你想要的修改..."
            />

            {/* Quick tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {quickTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => handleTagClick(tag.instruction)}
                  className="flex items-center gap-1 rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-400 hover:border-zinc-700/60 hover:text-zinc-300 transition-colors"
                >
                  <tag.icon className="size-3" />
                  {tag.label}
                </button>
              ))}
            </div>

            <div className="mt-auto flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-zinc-700/50 bg-zinc-900/60 py-2 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isGenerating || !instruction.trim()}
                onClick={handleGenerate}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-semibold text-black shadow-lg shadow-white/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
              >
                {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                {isGenerating ? "生成中..." : "生成"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
