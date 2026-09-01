"use client";

import { useState } from "react";
import {
  Plus,
  UserRound,
  Stamp,
  CircleHelp,
} from "lucide-react";
import AddNodePopover from "./AddNodePopover";
import type { CreateKind } from "./types";

export default function LeftRail({
  onCreate,
}: {
  onCreate: (kind: CreateKind, label: string, gradient: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-1/2 left-4 z-20 flex -translate-y-1/2 items-center">
      {/* 竖条 rail */}
      <div className="flex w-14 flex-col items-center gap-2 rounded-[52px] border border-white bg-white/80 py-[11px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {/* 黑色 + 主按钮 → addNodePopover */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-[inset_0_0_12px_rgba(255,255,255,0.5),0_2px_3px_rgba(0,0,0,0.08),0_6px_10px_rgba(0,0,0,0.08)] transition-transform duration-200 ${
            open ? "rotate-45" : "hover:scale-105"
          }`}
        >
          <Plus size={17} />
          {!open && (
            <span className="absolute -top-1.5 -right-2 rounded-full bg-[#aa80ff] px-1.5 py-px text-[9px] font-semibold text-white shadow-sm">
              New
            </span>
          )}
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black">
          <UserRound size={17} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black">
          <Stamp size={17} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black">
          <CircleHelp size={17} />
        </button>
      </div>

      {/* 添加节点弹层（§5：300 宽分组 + 副标 + New 角标） */}
      {open && <AddNodePopover onCreate={onCreate} />}
    </div>
  );
}
