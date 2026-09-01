"use client";

import { useState, useRef, useEffect } from "react";
import { X, Check } from "lucide-react";

interface ParamPopoverProps {
  open: boolean;
  type: "duration" | "ratio" | "resolution" | "style" | "mode";
  value: string | number;
  onChange: (value: string | number) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

// 参数配置
const PARAM_CONFIG: Record<string, {
  title: string;
  options: { value: string | number; label: string }[];
  type: "slider" | "dropdown";
  min?: number;
  max?: number;
  step?: number;
}> = {
  duration: {
    title: "视频时长",
    options: [
      { value: 5, label: "5秒" },
      { value: 10, label: "10秒" },
      { value: 15, label: "15秒" },
    ],
    type: "slider",
    min: 1,
    max: 15,
    step: 1,
  },
  ratio: {
    title: "画面比例",
    options: [
      { value: "16:9", label: "16:9 横屏" },
      { value: "9:16", label: "9:16 竖屏" },
      { value: "1:1", label: "1:1" },
      { value: "4:3", label: "4:3" },
    ],
    type: "dropdown",
  },
  resolution: {
    title: "分辨率",
    options: [
      { value: "480p", label: "480p" },
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
    ],
    type: "dropdown",
  },
  style: {
    title: "生成模式",
    options: [
      { value: "none", label: "无" },
      { value: "image", label: "图生" },
      { value: "multi", label: "多图参考" },
      { value: "full", label: "全参考" },
    ],
    type: "dropdown",
  },
  mode: {
    title: "运镜",
    options: [
      { value: "none", label: "关闭" },
      { value: "auto", label: "自动" },
    ],
    type: "dropdown",
  },
};

export default function ParamPopover({ open, type, value, onChange, onClose, position }: ParamPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const config = PARAM_CONFIG[type];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open || !config) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={ref}
        className="absolute w-64 rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        style={{ left: position?.x || 100, top: position?.y || 100 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <span className="text-sm font-medium text-zinc-700">{config.title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {config.type === "slider" ? (
            <div className="space-y-4">
              <input
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={value as number}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{config.min}秒</span>
                <span className="font-medium text-cyan-600">{value}秒</span>
                <span>{config.max}秒</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {config.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                    value === option.value ? "bg-cyan-50 text-cyan-600" : "text-zinc-700"
                  }`}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="size-4 text-cyan-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
