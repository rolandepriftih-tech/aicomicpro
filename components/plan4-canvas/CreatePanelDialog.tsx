"use client";

import { useState, useEffect, useRef } from "react";
import { X, Film } from "lucide-react";

interface CreatePanelDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    panelId: number;
    storyBeat: string;
    englishImagePrompt: string;
    chineseDirectorNotes: string;
  }) => void;
  suggestedId?: number;
}

export default function CreatePanelDialog({
  open,
  onClose,
  onConfirm,
  suggestedId = 1,
}: CreatePanelDialogProps) {
  const [panelId, setPanelId] = useState(suggestedId.toString());
  const [storyBeat, setStoryBeat] = useState("");
  const [englishImagePrompt, setEnglishImagePrompt] = useState("");
  const [chineseDirectorNotes, setChineseDirectorNotes] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);

  // 当打开弹窗时，更新 panelId 为 suggestedId
  useEffect(() => {
    if (open) {
      setPanelId(suggestedId.toString());
      confirmRef.current?.focus();
    }
  }, [open, suggestedId]);

  const handleConfirm = () => {
    const id = parseInt(panelId, 10);
    if (isNaN(id) || id < 1) return;
    onConfirm({
      panelId: id,
      storyBeat: storyBeat.trim() || `分镜 #${id}`,
      englishImagePrompt: englishImagePrompt.trim(),
      chineseDirectorNotes: chineseDirectorNotes.trim(),
    });
    setStoryBeat("");
    setEnglishImagePrompt("");
    setChineseDirectorNotes("");
  };

  const handleClose = () => {
    setStoryBeat("");
    setEnglishImagePrompt("");
    setChineseDirectorNotes("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-200">创建分镜节点</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              分镜编号
            </label>
            <input
              type="number"
              min={1}
              value={panelId}
              onChange={(e) => setPanelId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
              placeholder="1"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              故事节拍
            </label>
            <input
              type="text"
              value={storyBeat}
              onChange={(e) => setStoryBeat(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
              placeholder="一句话描述这一幕..."
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              中文导演备注
            </label>
            <textarea
              value={chineseDirectorNotes}
              onChange={(e) => setChineseDirectorNotes(e.target.value)}
              className="h-16 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-zinc-300 focus:border-violet-500/50 focus:outline-none [scrollbar-color:theme(colors.zinc.600)_transparent] [scrollbar-width:thin]"
              placeholder="给团队看的中文画面说明..."
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              英文生图提示词
            </label>
            <textarea
              value={englishImagePrompt}
              onChange={(e) => setEnglishImagePrompt(e.target.value)}
              className="h-20 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-zinc-300 focus:border-violet-500/50 focus:outline-none [scrollbar-color:theme(colors.zinc.600)_transparent] [scrollbar-width:thin]"
              placeholder="给生图模型用的英文提示词..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            取消
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={!panelId || parseInt(panelId, 10) < 1}
            onClick={handleConfirm}
            className="rounded-md border border-violet-500/50 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-950/60 disabled:opacity-40"
          >
            创建分镜
          </button>
        </div>
      </div>
    </div>
  );
}
