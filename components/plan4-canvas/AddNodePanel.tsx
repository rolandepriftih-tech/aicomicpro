"use client";

import { useState } from "react";
import { X, User, Image, Film, Music, FileText, Box, Upload, FolderOpen } from "lucide-react";

interface AddNodePanelProps {
  open: boolean;
  onClose: () => void;
  onAddNode?: (type: string) => void;
  position?: { x: number; y: number };
}

// 节点类型
const NODE_TYPES = [
  { id: "character", name: "角色", icon: User, color: "bg-cyan-100 text-cyan-600" },
  { id: "scene", name: "场景", icon: Image, color: "bg-violet-100 text-violet-600" },
  { id: "3d", name: "3D导演台", icon: Box, color: "bg-amber-100 text-amber-600", isNew: true },
  { id: "text", name: "文本", icon: FileText, color: "bg-emerald-100 text-emerald-600" },
  { id: "image", name: "图片", icon: Image, color: "bg-pink-100 text-pink-600" },
  { id: "video", name: "视频", icon: Film, color: "bg-blue-100 text-blue-600" },
  { id: "audio", name: "音频", icon: Music, color: "bg-orange-100 text-orange-600" },
];

export default function AddNodePanel({ open, onClose, onAddNode, position }: AddNodePanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute w-72 rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        style={{ left: position?.x || 100, top: position?.y || 100 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <span className="text-sm font-medium text-zinc-700">添加节点</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 节点类型网格 */}
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2">
            {NODE_TYPES.map((nodeType) => (
              <button
                key={nodeType.id}
                type="button"
                onClick={() => {
                  onAddNode?.(nodeType.id);
                  onClose();
                }}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              >
                <div className={`size-10 rounded-lg flex items-center justify-center ${nodeType.color}`}>
                  <nodeType.icon className="size-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-zinc-700">{nodeType.name}</div>
                  {nodeType.isNew && (
                    <span className="text-[8px] text-violet-500 font-medium">New</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 添加资源 */}
        <div className="px-4 py-3 border-t border-zinc-100">
          <div className="text-[10px] text-zinc-400 mb-2">添加资源</div>
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
              <Upload className="size-3.5" />
              上传
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors">
              <FolderOpen className="size-3.5" />
              从资产库选择
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
