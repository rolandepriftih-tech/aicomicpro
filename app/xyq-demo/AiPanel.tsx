"use client";

import { useState } from "react";
import {
  MessageSquarePlus,
  X,
  Clock,
  PanelRightClose,
  Plus,
  Image as ImageIcon,
  BarChart3,
  Sparkles,
  ChevronDown,
  ArrowUp,
  Wand2,
} from "lucide-react";

const toolChip =
  "flex h-[30px] items-center gap-1 rounded-full px-2 text-[12px] font-medium text-black/60 transition-colors hover:bg-black/[0.06] hover:text-black";

export default function AiPanel({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState("");

  return (
    <aside className="flex h-full w-[500px] shrink-0 flex-col border-l border-black/[0.05] bg-white">
      {/* 面板顶栏 */}
      <div className="flex h-12 shrink-0 items-center gap-1 px-3">
        <button className="flex h-[30px] items-center gap-1.5 rounded-full bg-black/[0.05] px-3 text-[13px] text-black transition-colors hover:bg-black/[0.08]">
          <MessageSquarePlus size={14} />
          新对话
          <X size={12} className="text-black/40" />
        </button>
        <div className="ml-auto flex items-center gap-0.5 text-black/60">
          <button className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/[0.06]">
            <Clock size={15} />
          </button>
          <button
            onClick={onClose}
            title="收起面板"
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/[0.06]"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>

      {/* 空态欢迎 */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <div className="relative rounded-2xl border border-black/[0.05] bg-white px-4 py-2 text-[12px] text-black/70 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            试试对我说：「帮我生成一个赛博朋克风格的主角」
            <span className="absolute -bottom-1 right-8 h-2.5 w-2.5 rotate-45 border-r border-b border-black/[0.05] bg-white" />
          </div>
        </div>
        <h2 className="text-[16px] font-medium text-black">Hi，创作者 👋</h2>
        <p className="mt-2 text-[16px] font-medium text-black/85">
          和 AI Comic 一起聊聊创作想法
        </p>
      </div>

      {/* 输入区 */}
      <div className="shrink-0 px-4 pb-2">
        <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_10px_15px_-5px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-shadow focus-within:shadow-[0_0_0_1.5px_#aa80ff,0_10px_15px_-5px_rgba(0,0,0,0.05)]">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="与创作助手对话，支持多种能力…"
            rows={2}
            className="w-full resize-none bg-transparent text-[14px] text-black outline-none placeholder:text-black/30"
          />
          <div className="mt-1 flex items-center gap-0.5">
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] text-black/60 transition-colors hover:bg-black/[0.05]">
              <Plus size={15} />
            </button>
            <button className={toolChip}>
              <ImageIcon size={14} />
              <ChevronDown size={11} className="text-black/40" />
            </button>
            <button className={toolChip}>
              <BarChart3 size={14} />
              <ChevronDown size={11} className="text-black/40" />
            </button>
            <button className={toolChip}>
              <Wand2 size={13} />
              技能
            </button>
            <button className={toolChip}>
              720P · 2K
              <ChevronDown size={11} className="text-black/40" />
            </button>
            <button
              className={`ml-auto flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                value.trim()
                  ? "bg-gradient-to-br from-[#e0d2fc] to-[#aa80ff] text-white shadow-[0_2px_6px_rgba(160,120,255,0.6)]"
                  : "bg-black/[0.05] text-black/30"
              }`}
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
        <p className="pt-2 pb-1 text-center text-[11px] text-black/40">
          AI 可能会犯错，内容仅供参考，请核查重要信息。
        </p>
      </div>
    </aside>
  );
}
