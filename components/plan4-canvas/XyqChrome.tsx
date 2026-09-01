"use client";

/**
 * 小云雀卡片共享部件（规格：docs/CARD_SPEC_SUPPLEMENT.md，全部 CDP 实测值）
 * 只承担视觉与交互外壳，不含业务逻辑。
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import {
  ArrowUp,
  Loader2,
  MoreHorizontal,
  Plus,
  Image as ImageIcon,
  Upload,
  Clapperboard,
  Scissors,
  AudioLines,
  Scan,
  Wand,
  Sun,
  RotateCw,
  Sparkles,
  Layers,
  Crop,
  Maximize,
} from "lucide-react";

/* ============================================================
 * 卡面：磨砂白卡，状态机由 CSS 变量驱动（默认/hover/选中）
 * ============================================================ */
export function CardShell({
  selected,
  className = "",
  style,
  children,
}: {
  selected?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    // backdrop-filter 用内联：dev 构建的 lightningcss 会按旧 browserslist 把 unprefixed 降级成
    // -webkit- 前缀，现代 Chrome 不认（计算值变 none）；package.json 已加现代目标，双保险
    <div
      className={`xyq-card ${className}`}
      data-selected={selected ? "true" : "false"}
      style={{ backdropFilter: "blur(40px)", ...style }}
    >
      {children}
    </div>
  );
}

/* ============================================================
 * 类型标签：卡上方 12px 灰字（如「角色」「分镜」「视频」）
 * ============================================================ */
export function NodeTypeTag({ label }: { label: string }) {
  return <span className="xyq-type-tag">{label}</span>;
}

/* ============================================================
 * attached-label：卡下方 标题行（13px 黑 + 橙 tag + ⋯）+ 元信息行（12px 灰）
 * ============================================================ */
export function AttachedLabel({
  title,
  tag,
  meta,
  onMore,
}: {
  title: string;
  tag?: string;
  meta?: string;
  onMore?: () => void;
}) {
  return (
    <div className="xyq-attached">
      <div className="xyq-attached-title-row">
        <span className="xyq-attached-title" title={title}>
          {title || "未命名标题"}
        </span>
        {tag && <span className="xyq-attached-tag">{tag}</span>}
        <button
          type="button"
          className="xyq-attached-more"
          onClick={(e) => {
            e.stopPropagation();
            onMore?.();
          }}
          title="更多"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      {meta && (
        <div className="xyq-attached-meta">
          <span>{meta}</span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 选中工具条：卡顶上方 28px 居中，r32 磨砂胶囊（selectionToolbar 复刻）
 * 空 content 时全部禁用（仅"更多"可用），与小云雀一致
 * ============================================================ */
export interface ToolItem {
  id: string;
  label: string;
  icon: ReactNode;
}

/** 图片卡工具组（实测小云雀：720°全景图/超分/图层分离/裁剪/旋转/更多） */
export const IMAGE_TOOL_ITEMS: ToolItem[] = [
  { id: "panorama", label: "720°全景图", icon: <Maximize className="size-3.5" /> },
  { id: "upscale", label: "超分", icon: <Sparkles className="size-3.5" /> },
  { id: "layer-separate", label: "图层分离", icon: <Layers className="size-3.5" /> },
  { id: "crop", label: "裁剪", icon: <Crop className="size-3.5" /> },
  { id: "rotate", label: "旋转", icon: <RotateCw className="size-3.5" /> },
];

/** 视频卡工具组（实测小云雀：抽帧/提升画质/截取/音频分离/裁剪/解析/智能抠像/片段重拍/打光/旋转/更多） */
export const VIDEO_TOOL_ITEMS: ToolItem[] = [
  { id: "extract-frames", label: "抽帧", icon: <ImageIcon className="size-3.5" /> },
  { id: "enhance", label: "提升画质", icon: <Sparkles className="size-3.5" /> },
  { id: "clip", label: "截取", icon: <Scissors className="size-3.5" /> },
  { id: "audio-separate", label: "音频分离", icon: <AudioLines className="size-3.5" /> },
  { id: "crop", label: "裁剪", icon: <Crop className="size-3.5" /> },
  { id: "parse", label: "解析", icon: <Scan className="size-3.5" /> },
  { id: "matting", label: "智能抠像", icon: <Wand className="size-3.5" /> },
  { id: "reshoot", label: "片段重拍", icon: <Clapperboard className="size-3.5" /> },
  { id: "relight", label: "打光", icon: <Sun className="size-3.5" /> },
  { id: "rotate", label: "旋转", icon: <RotateCw className="size-3.5" /> },
];

export function SelectionToolbar({
  visible,
  tools,
  disabled,
  onTool,
  onMore,
}: {
  visible: boolean;
  tools: ToolItem[];
  /** 无内容时全部禁用（小云雀行为） */
  disabled?: boolean;
  onTool?: (id: string) => void;
  onMore?: () => void;
}) {
  return (
    <NodeToolbar position={Position.Top} offset={28} isVisible={visible} className="xyq-toolbar-wrap">
      <div className="xyq-toolbar" style={{ backdropFilter: "blur(6px)" }}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="xyq-toolbar-btn"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onTool?.(tool.id);
            }}
            title={tool.label}
          >
            {tool.icon}
            <span>{tool.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="xyq-toolbar-btn xyq-toolbar-btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onMore?.();
          }}
          title="更多"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </NodeToolbar>
  );
}

/* ============================================================
 * 空卡操作：上传 / 资产库（透明底黑字 12px/500）
 * ============================================================ */
export function EmptyCardActions({
  onUpload,
  onLibrary,
}: {
  onUpload: () => void;
  onLibrary: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="xyq-empty-action" onClick={(e) => { e.stopPropagation(); onUpload(); }}>
        <Upload className="size-3" />
        <span>上传</span>
      </button>
      <button type="button" className="xyq-empty-action" onClick={(e) => { e.stopPropagation(); onLibrary(); }}>
        <ImageIcon className="size-3" />
        <span>资产库</span>
      </button>
    </div>
  );
}

/* ============================================================
 * 连接 handle：34px 磨砂白圆 + 加号（hover/选中浮现）
 * ============================================================ */
export function XyqHandle({ type, position, id }: { type: "source" | "target"; position: Position; id?: string }) {
  return (
    <Handle type={type} position={position} id={id} className="xyq-handle" style={{ backdropFilter: "blur(6px)" }}>
      <Plus className="size-[17px]" strokeWidth={1.8} />
    </Handle>
  );
}

/* ============================================================
 * 参数胶囊 chip + 下拉（风格/引擎/比例/时长/分辨率）
 * ============================================================ */
export function XyqChipDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="xyq-chip"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {label && <span className="xyq-chip-label">{label}</span>}
        <span>{current?.label || value}</span>
      </button>
      {open && (
        <div className="xyq-menu" onClick={(e) => e.stopPropagation()}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="xyq-menu-item"
              data-active={option.value === value}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 生成按钮：36px 黑色圆 + 上箭头（小云雀 composer 实测样式）
 * ============================================================ */
export function GenerateCircleButton({
  disabled,
  generating,
  onClick,
  title = "生成",
}: {
  disabled?: boolean;
  generating?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="xyq-generate-btn"
      disabled={disabled || generating}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
    >
      {generating ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.2} />}
    </button>
  );
}
