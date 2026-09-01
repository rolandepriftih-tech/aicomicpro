"use client";

import { useState } from "react";
import { ChevronDown, Share, User, Save, Check } from "lucide-react";

interface TopToolbarProps {
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
  saveStatus?: "unsaved" | "saving" | "saved";
  currentStyle?: string;
  onStyleChange?: (style: string) => void;
  aspectRatio?: string;
  onAspectRatioChange?: (ratio: string) => void;
  credits?: number;
}

// 风格列表
const STYLES = [
  { id: "cyberpunk", name: "赛博朋克" },
  { id: "anime", name: "日系动漫" },
  { id: "watercolor", name: "水彩画风" },
  { id: "oil-painting", name: "油画风格" },
  { id: "pixel-art", name: "像素艺术" },
  { id: "realistic", name: "写实风格" },
  { id: "cartoon", name: "卡通风格" },
  { id: "ghibli", name: "吉卜力风" },
];

// 比例列表
const ASPECT_RATIOS = [
  { id: "16:9", name: "16:9 横屏" },
  { id: "9:16", name: "9:16 竖屏" },
  { id: "1:1", name: "1:1" },
  { id: "4:3", name: "4:3" },
];

export default function TopToolbar({
  projectName = "未命名",
  onProjectNameChange,
  saveStatus = "saved",
  currentStyle = "cyberpunk",
  onStyleChange,
  aspectRatio = "16:9",
  onAspectRatioChange,
  credits = 60,
}: TopToolbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(projectName);

  const saveStatusConfig = {
    unsaved: { text: "未保存", color: "text-zinc-400" },
    saving: { text: "保存中", color: "text-amber-400" },
    saved: { text: "已保存", color: "text-emerald-400" },
  };

  const currentStyleName = STYLES.find((s) => s.id === currentStyle)?.name || "风格";
  const currentRatioName = ASPECT_RATIOS.find((r) => r.id === aspectRatio)?.name || aspectRatio;

  return (
    <div className="flex items-center justify-between h-12 px-4 bg-white border-b border-zinc-200">
      {/* 左侧：项目名 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-zinc-800">AI Comic Pro</span>
        <span className="text-zinc-300">|</span>
        {isEditingName ? (
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => {
              onProjectNameChange?.(localName);
              setIsEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onProjectNameChange?.(localName);
                setIsEditingName(false);
              }
            }}
            className="text-sm text-zinc-700 bg-zinc-100 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-cyan-400"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {projectName}
          </button>
        )}
        <div className={`flex items-center gap-1 text-[10px] ${saveStatusConfig[saveStatus].color}`}>
          {saveStatus === "saved" ? (
            <Check className="size-3" />
          ) : saveStatus === "saving" ? (
            <Save className="size-3 animate-pulse" />
          ) : null}
          <span>{saveStatusConfig[saveStatus].text}</span>
        </div>
      </div>

      {/* 中间：风格和比例 */}
      <div className="flex items-center gap-4">
        {/* 风格下拉 */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
            <span>🎨</span>
            <span>{currentStyleName}</span>
            <ChevronDown className="size-3 text-zinc-400" />
          </button>
          <div className="absolute top-full left-0 z-50 mt-1 w-40 rounded-lg border border-zinc-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            {STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => onStyleChange?.(style.id)}
                className={`flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 ${
                  currentStyle === style.id ? "text-cyan-600 bg-cyan-50" : "text-zinc-700"
                }`}
              >
                {style.name}
              </button>
            ))}
          </div>
        </div>

        {/* 比例下拉 */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
            <span>📐</span>
            <span>{currentRatioName}</span>
            <ChevronDown className="size-3 text-zinc-400" />
          </button>
          <div className="absolute top-full left-0 z-50 mt-1 w-32 rounded-lg border border-zinc-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                onClick={() => onAspectRatioChange?.(ratio.id)}
                className={`flex w-full items-center px-3 py-2 text-xs hover:bg-zinc-50 ${
                  aspectRatio === ratio.id ? "text-cyan-600 bg-cyan-50" : "text-zinc-700"
                }`}
              >
                {ratio.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧：积分、会员、分享、头像 */}
      <div className="flex items-center gap-3">
        {/* 积分 */}
        <div className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2.5 py-1 text-[10px] font-medium text-white">
          <span>✦</span>
          <span>{credits}</span>
        </div>

        {/* 开会员 */}
        <button className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
          开会员
        </button>

        {/* 分享 */}
        <button className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
          <Share className="size-3" />
          <span>分享</span>
        </button>

        {/* 头像 */}
        <div className="size-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
          <User className="size-4 text-white" />
        </div>
      </div>
    </div>
  );
}
