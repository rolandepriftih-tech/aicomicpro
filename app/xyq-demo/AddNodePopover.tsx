"use client";

import {
  UserRound,
  Building2,
  Box,
  Clapperboard,
  Image as ImageIcon,
  Type as TypeIcon,
  AudioLines,
} from "lucide-react";
import type { CreateKind } from "./types";

/* ---------- 添加节点弹层（CARD_SPEC_SUPPLEMENT.md §5 实测） ----------
   300 宽；分组：角色(副标) · 场景 · 3D导演台(New) · 文本 · 图片 · 视频(副标) · 音频 */
const GROUPS: {
  group?: string;
  items: {
    label: string;
    sub?: string;
    badge?: string;
    icon: React.ReactNode;
    kind: CreateKind;
    gradient: string;
  }[];
}[] = [
  {
    group: "角色",
    items: [
      {
        label: "新角色",
        sub: "全剧新角色、已有角色新形象",
        icon: <UserRound size={17} />,
        kind: "image",
        gradient: "linear-gradient(135deg, #ffd8a8, #ffb3ba)",
      },
    ],
  },
  {
    group: "场景",
    items: [
      {
        label: "场景",
        icon: <Building2 size={17} />,
        kind: "image",
        gradient: "linear-gradient(135deg, #a8d8ff, #b3c6ff)",
      },
    ],
  },
  {
    group: "3D 导演台",
    items: [
      {
        label: "3D 导演台",
        badge: "New",
        icon: <Box size={17} />,
        kind: "image",
        gradient: "linear-gradient(135deg, #d0bfff, #eebefa)",
      },
    ],
  },
  {
    group: "文本",
    items: [
      {
        label: "文本",
        icon: <TypeIcon size={17} />,
        kind: "text",
        gradient: "linear-gradient(135deg, #d5d5dc, #b9b9c4)",
      },
    ],
  },
  {
    group: "图片",
    items: [
      {
        label: "图片",
        icon: <ImageIcon size={17} />,
        kind: "image",
        gradient: "linear-gradient(135deg, #ffc9c9, #ffa8a8)",
      },
    ],
  },
  {
    group: "视频",
    items: [
      {
        label: "视频",
        sub: "片段、参考运镜",
        icon: <Clapperboard size={17} />,
        kind: "video",
        gradient: "linear-gradient(135deg, #8ce99a, #38d9a9)",
      },
    ],
  },
  {
    group: "音频",
    items: [
      {
        label: "音频",
        icon: <AudioLines size={17} />,
        kind: "text",
        gradient: "linear-gradient(135deg, #ffe066, #fcc419)",
      },
    ],
  },
];

export default function AddNodePopover({
  onCreate,
}: {
  onCreate: (kind: CreateKind, label: string, gradient: string) => void;
}) {
  return (
    <div className="xyq-popover ml-3 flex max-h-[70vh] w-[300px] flex-col overflow-y-auto rounded-2xl border border-black/[0.05] bg-white p-2 shadow-[0_12px_32px_rgba(16,16,16,0.12),0_2px_6px_rgba(16,16,16,0.06)]">
      {GROUPS.map((g) => (
        <div key={g.group} className="mb-0.5">
          <div className="px-2 pt-2 pb-1 text-[12px] font-medium text-black/45">
            {g.group}
          </div>
          {g.items.map((item) => (
            <button
              key={item.label}
              onClick={() => onCreate(item.kind, item.label, item.gradient)}
              className="flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-black/[0.04]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-black/[0.04] text-black/60">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] text-black">
                  {item.label}
                  {item.badge && (
                    <span className="rounded-full bg-[#aa80ff] px-1.5 text-[9px] font-semibold leading-[15px] text-white">
                      {item.badge}
                    </span>
                  )}
                </span>
                {item.sub && (
                  <span className="addNodeSubLabel block truncate text-[11px] text-black/40">
                    {item.sub}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
