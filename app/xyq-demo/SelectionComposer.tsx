"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, ChevronDown, Crown, Sparkles } from "lucide-react";

/* ---------- 参数 chip ---------- */
function ParamChip({
  label,
  suffix,
  accent,
  onClick,
}: {
  label: string;
  suffix?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[30px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors hover:bg-black/[0.08] ${
        accent ? "text-[#8149f2]" : "text-black/60"
      }`}
    >
      {label}
      {suffix && <span className="text-black/40">{suffix}</span>}
      {suffix !== undefined && <ChevronDown size={11} className="text-black/40" />}
    </button>
  );
}

/* ---------- 选中卡的底部创作栏（CARD_SPEC_SUPPLEMENT.md §3.2/§3.3 实测） ----------
   参数条 + tiptap 风格提示词编辑器（973×94）+ 35px 圆形生成按钮 + 积分标签 */
export default function SelectionComposer({
  kind,
  prompt,
  onPromptChange,
  onGenerate,
  generating,
}: {
  kind: "image" | "video" | "text";
  prompt: string;
  onPromptChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  /* 挂载即聚焦，模拟剪映选中即可输入 */
  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const isVideo = kind === "video";

  return (
    <div className="xyq-popover pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(1000px,calc(100%-96px))] -translate-x-1/2">
      <div className="rounded-[32px] bg-white/90 p-3 shadow-[inset_0_0_0_1px_#fff,0_12px_32px_rgba(16,16,16,0.12),0_2px_6px_rgba(16,16,16,0.06)] backdrop-blur-xl">
        {/* 参数条 */}
        <div className="scrollbar-none flex items-center gap-0.5 overflow-x-auto">
          <ParamChip
            label={isVideo ? "风格 2.0 Fast" : "Seedream 5.0 Pro"}
            suffix=""
          />
          {isVideo ? (
            <>
              <span className="flex h-[22px] shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-[#e0d2fc] to-[#ccb2ff] px-2 text-[11px] font-medium text-[#5b21b6]">
                <Crown size={10} fill="currentColor" /> VIP
              </span>
              <ParamChip label="480P" suffix="" />
              <ParamChip label="10s" suffix="" />
              <ParamChip label="全参考运镜" suffix="" />
              <ParamChip label="Seed" suffix="" />
            </>
          ) : (
            <>
              <ParamChip label="9:16 · 1K" suffix="" />
              <span className="flex h-[22px] shrink-0 items-center rounded-full bg-gradient-to-r from-[#e0d2fc] to-[#ccb2ff] px-2 text-[11px] font-medium text-[#5b21b6]">
                限免
              </span>
            </>
          )}
          <button className="flex h-[30px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-black/40 transition-colors hover:bg-black/[0.06]">
            <Sparkles size={12} />
            可选预设提示词
          </button>
        </div>

        {/* 提示词编辑器 + 生成按钮 */}
        <div className="mt-1 flex items-end gap-2">
          <textarea
            ref={editorRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={
              isVideo
                ? "描述画面 / 运镜 / 节奏，Enter 换行…"
                : "描述你想要的画面，主体、风格、构图…"
            }
            rows={2}
            className="h-[94px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-[1.5] text-black outline-none placeholder:text-black/30"
          />
          <div className="flex shrink-0 items-center gap-1.5 pb-1 pr-1">
            {/* 积分标签（xyq-generation-credit-cost） */}
            <span className="flex h-7 items-center gap-1 rounded-full bg-black/[0.04] px-2 text-[12px] font-medium text-black/60">
              <span className="text-[#8149f2]">✦</span>
              {isVideo ? "50" : "20"}
            </span>
            <button
              onClick={onGenerate}
              disabled={generating}
              className={`flex h-[35px] w-[35px] items-center justify-center rounded-full transition-all ${
                generating
                  ? "bg-black/[0.06] text-black/30"
                  : "bg-gradient-to-br from-[#e0d2fc] to-[#aa80ff] text-white shadow-[0_2px_8px_rgba(160,120,255,0.5)] hover:brightness-105 active:scale-95"
              }`}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
