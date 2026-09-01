"use client";

import { Undo2, Redo2, Sparkles, Grid3x3, AlignCenter, Minus, Plus } from "lucide-react";

interface BottomActionBarProps {
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleGrid?: () => void;
  onToggleAlignment?: () => void;
}

export default function BottomActionBar({
  zoom = 46,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  onToggleGrid,
  onToggleAlignment,
}: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 bg-white border-t border-zinc-200">
      {/* 左侧：工具按钮 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          title="撤销"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          title="重做"
        >
          <Redo2 className="size-4" />
        </button>

        <div className="w-px h-4 bg-zinc-200 mx-1" />

        <button
          type="button"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          title="AI"
        >
          <Sparkles className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleGrid}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          title="网格"
        >
          <Grid3x3 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleAlignment}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          title="对齐"
        >
          <AlignCenter className="size-4" />
        </button>
      </div>

      {/* 中间：缩放控制 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onZoomOut}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <Minus className="size-3" />
        </button>
        <span className="text-xs text-zinc-600 w-12 text-center">{zoom}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* 右侧：素材/轨道缩略图入口 */}
      <div className="flex items-center gap-2">
        <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
          素材库
        </button>
        <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
          轨道
        </button>
      </div>
    </div>
  );
}
