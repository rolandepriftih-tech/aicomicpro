"use client";

import { useState } from "react";
import { Plus, AtSign, ChevronDown, Send, Loader2 } from "lucide-react";

interface BottomCommandBarProps {
  selectedNodeId?: string | null;
  onGenerate?: (prompt: string, options: any) => void;
  isGenerating?: boolean;
}

export default function BottomCommandBar({
  onGenerate,
  isGenerating = false,
}: BottomCommandBarProps) {
  const [prompt, setPrompt] = useState("");

  // 参数状态
  const [style] = useState("复古科幻原子朋克");
  const [ratio] = useState("9:16");
  const [resolution] = useState("720P");
  const [duration] = useState("10s");
  const [mode] = useState("全参考");

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate?.(prompt, { style, ratio, resolution, duration, mode });
    setPrompt("");
  };

  return (
    <div className="fixed bottom-12 left-0 right-0 z-40 flex justify-center px-4 pb-4">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-xl">
        {/* 提示词输入框 */}
        <div className="px-4 pt-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要生成的画面内容，@引用素材"
            className="w-full min-h-[80px] resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            rows={3}
          />
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* 左侧：工具按钮 */}
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors" title="添加上下文">
              <Plus className="size-4" />
            </button>
            <button className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors" title="引用素材">
              <AtSign className="size-4" />
            </button>

            {/* 当前风格 */}
            <button className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
              <span>🎨</span>
              <span>{style}</span>
              <ChevronDown className="size-3 text-zinc-400" />
            </button>

            {/* 比例 */}
            <button className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
              <span>📐</span>
              <span>{ratio}</span>
              <ChevronDown className="size-3 text-zinc-400" />
            </button>

            {/* 分辨率 */}
            <button className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
              <span>{resolution}</span>
              <ChevronDown className="size-3 text-zinc-400" />
            </button>

            {/* 时长 */}
            <button className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
              <span>{duration}</span>
              <ChevronDown className="size-3 text-zinc-400" />
            </button>

            {/* 生成模式 */}
            <button className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
              <span>{mode}</span>
              <ChevronDown className="size-3 text-zinc-400" />
            </button>

            {/* 更多 */}
            <button className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors" title="更多选项">
              <span className="text-xs">...</span>
            </button>
          </div>

          {/* 右侧：生成按钮 */}
          <button
            type="button"
            disabled={!prompt.trim() || isGenerating}
            onClick={handleGenerate}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-medium text-white hover:from-cyan-600 hover:to-blue-600 disabled:from-zinc-300 disabled:to-zinc-300 disabled:text-zinc-500 transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                生成中
              </>
            ) : (
              <>
                <Send className="size-4" />
                <span>✦ +260</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
