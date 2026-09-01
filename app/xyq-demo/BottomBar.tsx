"use client";

import {
  Undo2,
  Redo2,
  Spline,
  LocateFixed,
  Magnet,
  Hand,
  Minus,
  Plus,
} from "lucide-react";

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black disabled:opacity-30 disabled:hover:bg-transparent";

export default function BottomBar({
  zoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFit,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-full border border-white/60 bg-white/60 p-0.5 backdrop-blur-md">
      <button className={iconBtn} title="撤销" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={14} />
      </button>
      <button className={iconBtn} title="重做" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={14} />
      </button>
      <button className={iconBtn} title="连线模式">
        <Spline size={14} />
      </button>
      <button className={iconBtn} title="适应画布" onClick={onFit}>
        <LocateFixed size={14} />
      </button>
      <button
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
        title="磁吸（开）"
      >
        <Magnet size={14} />
      </button>
      <button className={iconBtn} title="抓手">
        <Hand size={14} />
      </button>

      {/* 缩放胶囊 */}
      <div className="ml-1 flex h-7 items-center rounded-full border border-white bg-white/90 px-1 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
        <button className={iconBtn} onClick={onZoomOut} title="缩小">
          <Minus size={13} />
        </button>
        <span className="w-12 text-center text-[11px] font-semibold text-black tabular-nums">
          {zoom}%
        </span>
        <button className={iconBtn} onClick={onZoomIn} title="放大">
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
