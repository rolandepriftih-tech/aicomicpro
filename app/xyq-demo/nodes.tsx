"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play,
  Image as ImageIcon,
  MoreVertical,
  Copy,
  Trash2,
  Wand2,
  Loader2,
  Plus,
  Upload,
  Library,
} from "lucide-react";
import type { DemoNodeData } from "./types";

/* ---------- 选中悬浮工具条（CARD_SPEC_SUPPLEMENT.md §3.1 实测） ----------
   距卡顶 28px 居中；bg 白 0.8 + blur(6px)；r32；
   shadow: inset 0 0 0 1px #fff, 0 12px 24px rgba(0,0,0,.04)；
   按钮 h32/r999/12px，可用纯黑、禁用 rgba(0,0,0,.2)；空卡仅"更多"可用 */
const VIDEO_TOOLS = [
  "抽帧",
  "提升画质",
  "截取",
  "音频分离",
  "裁剪",
  "解析",
  "智能抠像",
  "片段重拍",
  "打光",
  "旋转",
];
const IMAGE_TOOLS = ["720°全景图", "超分", "图层分离", "裁剪", "旋转"];

function SelectionToolbar({
  kind,
  disabled,
  onAction,
  onDuplicate,
  onVariant,
  onDelete,
}: {
  kind: "image" | "video" | "text";
  disabled: boolean;
  onAction: (name: string) => void;
  onDuplicate: () => void;
  onVariant: () => void;
  onDelete: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  /* 视频工具条较宽：测宽后 clamp 在画布范围内，避免悬到 AI 面板下 */
  const barRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  useEffect(() => {
    const el = barRef.current;
    const canvas = el?.closest(".xyq-canvas")?.getBoundingClientRect();
    if (!el || !canvas) return;
    const r = el.getBoundingClientRect();
    const pad = 12;
    const overflowR = r.right - canvas.right + pad;
    const overflowL = canvas.left + pad - r.left;
    if (overflowR > 0) setDx(-overflowR);
    else if (overflowL > 0) setDx(overflowL);
    else setDx(0);
  }, []);
  const tools = kind === "video" ? VIDEO_TOOLS : kind === "image" ? IMAGE_TOOLS : [];
  return (
    <div
      className="absolute bottom-full left-1/2 z-20 mb-[28px]"
      style={{ transform: `translateX(calc(-50% + ${dx}px))` }}
    >
      <div
        ref={barRef}
        className="xyq-popover scrollbar-none flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[32px] bg-white/80 p-1 shadow-[inset_0_0_0_1px_#fff,0_12px_24px_rgba(0,0,0,0.04)] backdrop-blur-[6px]"
      >
        {tools.map((name) => (
          <button
            key={name}
            disabled={disabled}
            onClick={() => onAction(name)}
            className="relative flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] text-black transition-colors hover:bg-black/[0.06] disabled:text-black/20 disabled:hover:bg-transparent"
          >
            {name}
            {name === "片段重拍" && (
              <span className="absolute -top-1 right-0 rounded-full bg-gradient-to-r from-[#e0d2fc] to-[#aa80ff] px-1 text-[9px] font-medium leading-[14px] text-white">
                限免
              </span>
            )}
          </button>
        ))}
        {/* 更多：复制/变体/删除 */}
        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-black/[0.06]"
          >
            <MoreVertical size={15} />
          </button>
          {moreOpen && (
            <div className="xyq-popover absolute top-full right-0 z-30 mt-1.5 w-[136px] rounded-2xl border border-black/[0.06] bg-white p-1 shadow-[0_12px_32px_rgba(16,16,16,0.12),0_2px_6px_rgba(16,16,16,0.06)]">
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onDuplicate();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13px] text-black hover:bg-black/[0.05]"
              >
                <Copy size={13} className="text-black/50" /> 复制副本
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onVariant();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13px] text-black hover:bg-black/[0.05]"
              >
                <Wand2 size={13} className="text-black/50" /> 生成变体
              </button>
              <div className="mx-1 my-0.5 h-px bg-black/[0.06]" />
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onDelete();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13px] text-[#f64e4b] hover:bg-[#f64e4b]/[0.06]"
              >
                <Trash2 size={13} /> 删除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- 连接 handle（34px 磨砂圆 + Plus 图标，样式见 xyq.css） ---------- */
function CardHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left}>
        <Plus size={15} />
      </Handle>
      <Handle type="source" position={Position.Right}>
        <Plus size={15} />
      </Handle>
    </>
  );
}

/* ---------- 卡下 attached-label（§6 实测） ---------- */
function AttachedLabel({
  title,
  tag,
  meta,
}: {
  title: string;
  tag?: string;
  meta: string;
}) {
  return (
    <div className="mt-2 px-3">
      <div className="flex items-center gap-1.5">
        <span className="max-w-[180px] truncate text-[13px] leading-[18px] text-black">
          {title}
        </span>
        {tag && (
          <span className="shrink-0 rounded-full bg-[#fff1de] px-1.5 text-[10px] leading-[16px] text-[#f49336]">
            {tag}
          </span>
        )}
        <span className="ml-auto shrink-0 text-black/30">
          <MoreVertical size={13} />
        </span>
      </div>
      <div className="mt-0.5 truncate text-[12px] leading-[17px] text-black/40">{meta}</div>
    </div>
  );
}

/* ---------- 共用卡外壳 ----------
   wrap = 卡上类型小字 + 卡区（工具条锚点）+ 卡下标题区 */
function CardShell({
  typeLabel,
  kind,
  status,
  selected,
  dragging,
  title,
  tag,
  meta,
  children,
  onAction,
  onDuplicate,
  onVariant,
  onDelete,
}: {
  typeLabel: string;
  kind: DemoNodeData["kind"];
  status: DemoNodeData["status"];
  selected?: boolean;
  dragging?: boolean;
  title: string;
  tag?: string;
  meta: string;
  children: React.ReactNode;
  onAction: (name: string) => void;
  onDuplicate: () => void;
  onVariant: () => void;
  onDelete: () => void;
}) {
  const empty = status === "empty";
  return (
    <div className="xyq-node-enter w-fit">
      {/* 卡上 12px 灰类型小字（§6） */}
      <div className="mb-1 pl-4 text-[12px] leading-[17px] text-black/40">{typeLabel}</div>

      {/* 卡区：工具条 + 卡面 + handle */}
      <div className="relative">
        {selected && (
          <SelectionToolbar
            kind={kind}
            disabled={empty || status === "generating"}
            onAction={onAction}
            onDuplicate={onDuplicate}
            onVariant={onVariant}
            onDelete={onDelete}
          />
        )}
        <div
          className={`xyq-card relative overflow-hidden ${selected ? "xyq-card--selected" : ""} ${
            dragging ? "xyq-card--dragging" : ""
          }`}
        >
          {children}
          <CardHandles />
        </div>
      </div>

      {/* 卡下 attached-label */}
      <AttachedLabel title={title} tag={tag} meta={meta} />
    </div>
  );
}

/* ---------- 空卡态（§2：44×44 图标 + 上传/资产库 83×24 r32） ---------- */
function EmptyState({ onPick }: { onPick: (what: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/[0.05] text-black/40">
        <ImageIcon size={20} />
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPick("上传")}
          className="flex h-6 items-center gap-1 rounded-full px-3 text-[12px] font-medium text-black ring-1 ring-black/[0.12] transition-colors hover:bg-black/[0.04]"
        >
          <Upload size={12} /> 上传
        </button>
        <button
          onClick={() => onPick("资产库")}
          className="flex h-6 items-center gap-1 rounded-full px-3 text-[12px] font-medium text-black ring-1 ring-black/[0.12] transition-colors hover:bg-black/[0.04]"
        >
          <Library size={12} /> 资产库
        </button>
      </div>
    </div>
  );
}

/* ---------- 生成中遮罩 ---------- */
function GeneratingVeil() {
  return (
    <div className="xyq-shimmer absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
      <Loader2 size={20} className="animate-spin text-white" />
      <span className="text-[12px] font-medium text-white drop-shadow">
        正在生成…
      </span>
    </div>
  );
}

/* ---------- 图片节点（4:3） ---------- */
export function ImageNode({ data, selected, dragging }: NodeProps) {
  const d = data as DemoNodeData;
  const aspect = d.emptySquare ? "1 / 1" : "4 / 3";
  return (
    <CardShell
      typeLabel={d.typeLabel ?? "未命名图片"}
      kind="image"
      status={d.status}
      selected={selected}
      dragging={dragging}
      title={d.title}
      tag={d.tag}
      meta={d.meta ?? "出版链接 · 暂无"}
      onAction={(name) => d.onAction?.(d.id, name)}
      onDuplicate={() => d.onDuplicate?.(d.id)}
      onVariant={() => d.onVariant?.(d.id)}
      onDelete={() => d.onDelete?.(d.id)}
    >
      <div
        className="relative flex w-[300px] items-center justify-center"
        style={{ aspectRatio: aspect, background: d.gradient }}
      >
        {d.status === "empty" ? (
          <EmptyState onPick={(what) => d.onAction?.(d.id, what)} />
        ) : (
          <>
            <ImageIcon size={30} className="text-white/70" />
            {d.status === "generating" && <GeneratingVeil />}
          </>
        )}
      </div>
    </CardShell>
  );
}

/* ---------- 视频节点（9:16） ---------- */
export function VideoNode({ data, selected, dragging }: NodeProps) {
  const d = data as DemoNodeData;
  return (
    <CardShell
      typeLabel={d.typeLabel ?? "未命名视频"}
      kind="video"
      status={d.status}
      selected={selected}
      dragging={dragging}
      title={d.title}
      tag={d.tag}
      meta={d.meta ?? "出版链接 · 暂无"}
      onAction={(name) => d.onAction?.(d.id, name)}
      onDuplicate={() => d.onDuplicate?.(d.id)}
      onVariant={() => d.onVariant?.(d.id)}
      onDelete={() => d.onDelete?.(d.id)}
    >
      <div
        className="relative flex w-[180px] items-center justify-center"
        style={{ aspectRatio: "9 / 16", background: d.gradient }}
      >
        {d.status === "generating" ? (
          <GeneratingVeil />
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 ring-1 ring-white/60 backdrop-blur-md">
              <Play size={15} className="ml-0.5 text-white" fill="white" />
            </span>
            <span className="absolute right-3 bottom-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              {d.meta ?? "00:08"}
            </span>
          </>
        )}
      </div>
    </CardShell>
  );
}

/* ---------- 文本节点 ---------- */
export function TextNode({ data, selected, dragging }: NodeProps) {
  const d = data as DemoNodeData;
  return (
    <CardShell
      typeLabel={d.typeLabel ?? "文本"}
      kind="text"
      status={d.status}
      selected={selected}
      dragging={dragging}
      title={d.title}
      tag={d.tag}
      meta={d.meta ?? "出版链接 · 暂无"}
      onAction={(name) => d.onAction?.(d.id, name)}
      onDuplicate={() => d.onDuplicate?.(d.id)}
      onVariant={() => d.onVariant?.(d.id)}
      onDelete={() => d.onDelete?.(d.id)}
    >
      <div className="w-[260px] p-5">
        <p className="text-[14px] leading-[1.6] text-black/80">
          {d.text ?? "双击编辑文本内容…"}
        </p>
        {d.status === "generating" && <GeneratingVeil />}
      </div>
    </CardShell>
  );
}

export const demoNodeTypes = {
  demoImage: ImageNode,
  demoVideo: VideoNode,
  demoText: TextNode,
};
