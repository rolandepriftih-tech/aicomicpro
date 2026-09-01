"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[360px] rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-red-500/15" : "bg-amber-500/15"
            }`}
          >
            <AlertTriangle
              className={`size-5 ${danger ? "text-red-400" : "text-amber-400"}`}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              danger
                ? "border-red-500/50 bg-red-950/40 text-red-300 hover:bg-red-950/60"
                : "border-violet-500/50 bg-violet-950/40 text-violet-300 hover:bg-violet-950/60"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
