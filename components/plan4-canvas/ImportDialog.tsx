"use client";

import { useState } from "react";
import { X, Check, User, MapPin, Package, Rabbit, Box, Image } from "lucide-react";

interface ImportItem {
  id: string;
  name: string;
  description?: string;
  typeLabel: string;
  imageUrl?: string;
}

interface ImportDialogProps {
  open: boolean;
  title: string;
  items: ImportItem[];
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  角色: <User className="size-3.5" />,
  场景: <MapPin className="size-3.5" />,
  道具: <Package className="size-3.5" />,
  生物: <Rabbit className="size-3.5" />,
  座舱: <Box className="size-3.5" />,
  自定义: <Image className="size-3.5" />,
  分镜: <Image className="size-3.5" />,
};

export default function ImportDialog({
  open,
  title,
  items,
  onClose,
  onConfirm,
}: ImportDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = selected.size === items.length && items.length > 0;
  const someSelected = selected.size > 0 && selected.size < items.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    setSelected(new Set());
  };

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-[480px] flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
          <button
            type="button"
            onClick={toggleAll}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
              allSelected
                ? "border-violet-500/50 bg-violet-950/40 text-violet-300"
                : someSelected
                  ? "border-amber-500/50 bg-amber-950/40 text-amber-300"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <div
              className={`flex size-3.5 items-center justify-center rounded-sm border ${
                allSelected
                  ? "border-violet-400 bg-violet-500"
                  : someSelected
                    ? "border-amber-400 bg-amber-500"
                    : "border-zinc-600"
              }`}
            >
              {(allSelected || someSelected) && <Check className="size-2.5 text-white" strokeWidth={3} />}
            </div>
            {allSelected ? "取消全选" : "全选"}
          </button>
          <span className="text-[11px] text-zinc-500">
            已选 {selected.size} / {items.length}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">暂无可用项目</div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => {
                const isSel = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                      isSel
                        ? "border-violet-500/40 bg-violet-950/20"
                        : "border-transparent bg-zinc-800/50 hover:bg-zinc-800"
                    }`}
                  >
                    <div
                      className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSel ? "border-violet-400 bg-violet-500" : "border-zinc-600 bg-zinc-900"
                      }`}
                    >
                      {isSel && <Check className="size-3 text-white" strokeWidth={3} />}
                    </div>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="size-8 rounded-md object-cover" />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-md bg-zinc-800 text-zinc-500">
                        {typeIcons[item.typeLabel] ?? <Image className="size-3.5" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium text-zinc-200">{item.name}</span>
                        <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-500">
                          {item.typeLabel}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{item.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
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
            type="button"
            disabled={selected.size === 0}
            onClick={handleConfirm}
            className="rounded-md border border-violet-500/50 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-950/60 disabled:opacity-40"
          >
            导入 {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
