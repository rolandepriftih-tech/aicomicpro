"use client";

import { Copy, Scissors, Maximize2, Trash2, MoreHorizontal, CheckSquare } from "lucide-react";

interface CardToolbarProps {
  nodeId: string;
  visible: boolean;
  onAction?: (action: string, nodeId: string) => void;
  position?: { x: number; y: number };
}

export default function CardToolbar({ nodeId, visible, onAction, position }: CardToolbarProps) {
  if (!visible) return null;

  const actions = [
    { id: "selectAll", icon: CheckSquare, label: "全选" },
    { id: "copy", icon: Copy, label: "复制" },
    { id: "crop", icon: Scissors, label: "裁剪" },
    { id: "zoom", icon: Maximize2, label: "缩放" },
    { id: "delete", icon: Trash2, label: "删除" },
    { id: "more", icon: MoreHorizontal, label: "更多" },
  ];

  return (
    <div
      className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 shadow-lg"
      style={{ left: position?.x, top: position?.y }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(action.id, nodeId);
          }}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          title={action.label}
        >
          <action.icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
