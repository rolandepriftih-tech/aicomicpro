"use client";

import {
  FolderOpen,
  ChevronDown,
  Sparkles,
  Share2,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";

const glassBtn =
  "flex h-8 items-center gap-1 rounded-full border border-white bg-white/80 px-3 text-[13px] text-black shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-colors hover:bg-white";

export default function TopBar({ saved }: { saved: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-2 px-3">
      <div className="pointer-events-auto flex items-center gap-2">
        {/* logo + 画布名 + 保存状态 */}
        <div className="flex h-8 items-center gap-2 rounded-full border border-white bg-white/80 px-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black text-[10px] font-bold text-white">
            A
          </span>
          <span className="text-[13px] font-semibold text-black">AI Comic</span>
          <span className="h-3.5 w-px bg-black/10" />
          <span className="text-[13px] text-black/60">未命名画布</span>
          {saved ? (
            <span className="flex h-6 items-center gap-1 rounded-full bg-[#179f35]/[0.08] px-2 text-[12px] font-medium text-[#179f35]">
              <svg width="9" height="9" viewBox="0 0 9 9" className="shrink-0">
                <circle cx="4.5" cy="4.5" r="4.5" fill="#179f35" />
              </svg>
              已保存
            </span>
          ) : (
            <span className="flex h-6 items-center gap-1 rounded-full bg-black/[0.04] px-2 text-[12px] font-medium text-black/45">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/30" />
              保存中…
            </span>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* 风格库 + 画幅 */}
        <div className="pointer-events-auto flex items-center overflow-hidden rounded-full border border-white bg-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <button className={glassBtn + " rounded-none border-0 bg-transparent shadow-none"}>
            <FolderOpen size={14} className="text-black/60" />
            风格库
            <ChevronDown size={12} className="text-black/40" />
          </button>
          <span className="h-4 w-px bg-black/[0.08]" />
          <button className={glassBtn + " rounded-none border-0 bg-transparent shadow-none"}>
            9:16
            <ChevronDown size={12} className="text-black/40" />
          </button>
        </div>

        {/* 积分 + 会员 */}
        <div className="pointer-events-auto flex items-center overflow-hidden rounded-full border border-white bg-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <button className={glassBtn + " rounded-none border-0 bg-transparent shadow-none"}>
            <Sparkles size={13} className="text-[#8149f2]" fill="#aa80ff" />
            <span className="font-medium">60</span>
          </button>
          <span className="h-4 w-px bg-black/[0.08]" />
          <button className="h-8 px-3 text-[11px] font-medium text-black/80 transition-colors hover:text-black">
            开会员
          </button>
        </div>

        {/* 裸图标按钮 */}
        <div className="pointer-events-auto flex items-center gap-1 px-1">
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black">
            <Share2 size={16} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black">
            <BookOpen size={16} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black">
            <MoreHorizontal size={16} />
          </button>
          <span className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#e0d2fc] via-[#ccb2ff] to-[#aa80ff] text-[12px] font-semibold text-white ring-1 ring-white">
            智
          </span>
        </div>
      </div>
    </div>
  );
}
