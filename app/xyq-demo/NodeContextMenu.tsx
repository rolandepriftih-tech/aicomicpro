"use client";

import { useEffect, useRef } from "react";
import { Upload, Plus, ClipboardPaste, Undo2, Redo2 } from "lucide-react";

/* ---------- 画布空白右键菜单（CARD_SPEC_SUPPLEMENT.md §4 实测） ----------
   220 宽；上传 / 添加节点 / 粘贴 ⌘V / 撤销 ⌘Z / 重做 Shift+⌘Z；Esc 关闭 */
export default function NodeContextMenu({
  x,
  y,
  onClose,
  onUpload,
  onAddNode,
  onPaste,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onUpload: () => void;
  onAddNode: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /* Esc / 点击外部关闭 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick, true);
    };
  }, [onClose]);

  const item =
    "flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] text-black transition-colors hover:bg-black/[0.05] disabled:text-black/25 disabled:hover:bg-transparent";
  const kbd = "ml-auto text-[11px] text-black/30";

  return (
    <div
      ref={ref}
      className="xyq-popover fixed z-50 w-[220px] rounded-2xl border border-black/[0.05] bg-white p-1 shadow-[0_12px_32px_rgba(16,16,16,0.12),0_2px_6px_rgba(16,16,16,0.06)]"
      style={{
        left: Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 0) - 236),
        top: Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 0) - 280),
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className={item} onClick={onUpload}>
        <Upload size={14} className="text-black/50" /> 上传
      </button>
      <button className={item} onClick={onAddNode}>
        <Plus size={14} className="text-black/50" /> 添加节点
      </button>
      <div className="mx-1 my-0.5 h-px bg-black/[0.06]" />
      <button className={item} onClick={onPaste}>
        <ClipboardPaste size={14} className="text-black/50" /> 粘贴
        <span className={kbd}>⌘V</span>
      </button>
      <button className={item} onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={14} className="text-black/50" /> 撤销
        <span className={kbd}>⌘Z</span>
      </button>
      <button className={item} onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={14} className="text-black/50" /> 重做
        <span className={kbd}>⇧⌘Z</span>
      </button>
    </div>
  );
}
