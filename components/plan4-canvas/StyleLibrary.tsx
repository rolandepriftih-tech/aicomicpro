"use client";

import { useState } from "react";
import { X, Search, Check } from "lucide-react";

// 风格数据
const STYLE_CATEGORIES = [
  {
    id: "all",
    name: "全部",
  },
  {
    id: "anime",
    name: "动漫",
  },
  {
    id: "realistic",
    name: "真人",
  },
  {
    id: "2d",
    name: "2D",
  },
  {
    id: "3d",
    name: "3D",
  },
];

const STYLES = [
  {
    id: "cyberpunk",
    name: "赛博朋克",
    category: "3d",
    thumbnail: "https://via.placeholder.com/200x200/0ff/000?text=Cyberpunk",
    description: "未来科技感，霓虹灯效",
  },
  {
    id: "anime",
    name: "日系动漫",
    category: "anime",
    thumbnail: "https://via.placeholder.com/200x200/f0f/000?text=Anime",
    description: "日式动漫风格",
  },
  {
    id: "watercolor",
    name: "水彩画风",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/0af/000?text=Watercolor",
    description: "柔和水彩效果",
  },
  {
    id: "oil-painting",
    name: "油画风格",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/fa0/000?text=Oil+Painting",
    description: "经典油画质感",
  },
  {
    id: "pixel-art",
    name: "像素艺术",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/0f0/000?text=Pixel+Art",
    description: "复古像素风格",
  },
  {
    id: "realistic",
    name: "写实风格",
    category: "realistic",
    thumbnail: "https://via.placeholder.com/200x200/888/000?text=Realistic",
    description: "照片级真实感",
  },
  {
    id: "cartoon",
    name: "卡通风格",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/ff0/000?text=Cartoon",
    description: "可爱卡通画风",
  },
  {
    id: "ghibli",
    name: "吉卜力风",
    category: "anime",
    thumbnail: "https://via.placeholder.com/200x200/0f8/000?text=Ghibli",
    description: "宫崎骏动画风格",
  },
  {
    id: "comic",
    name: "漫画风格",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/f08/000?text=Comic",
    description: "美式漫画风格",
  },
  {
    id: "3d-render",
    name: "3D渲染",
    category: "3d",
    thumbnail: "https://via.placeholder.com/200x200/80f/000?text=3D+Render",
    description: "高质量3D渲染",
  },
  {
    id: "flat-design",
    name: "扁平设计",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/f80/000?text=Flat+Design",
    description: "简洁扁平风格",
  },
  {
    id: "sketch",
    name: "素描风格",
    category: "2d",
    thumbnail: "https://via.placeholder.com/200x200/888/fff?text=Sketch",
    description: "铅笔素描效果",
  },
];

interface StyleLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (styleId: string) => void;
  selectedStyle?: string;
}

export default function StyleLibrary({ open, onClose, onSelect, selectedStyle }: StyleLibraryProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!open) return null;

  const filteredStyles = STYLES.filter((style) => {
    const matchesCategory = activeCategory === "all" || style.category === activeCategory;
    const matchesSearch = style.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[600px] max-h-[80vh] rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <span className="text-sm font-medium text-zinc-700">风格库</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 分类标签 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
          {STYLE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                activeCategory === category.id
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索风格..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-4 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            />
          </div>
        </div>

        {/* 风格网格 */}
        <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-3">
            {filteredStyles.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  onSelect(style.id);
                  onClose();
                }}
                className={`group relative rounded-xl border-2 overflow-hidden transition-all ${
                  selectedStyle === style.id
                    ? "border-cyan-500 shadow-md"
                    : "border-transparent hover:border-zinc-200"
                }`}
              >
                <div className="aspect-square bg-zinc-100">
                  <img
                    src={style.thumbnail}
                    alt={style.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <div className="text-[10px] font-medium text-zinc-700 truncate">{style.name}</div>
                  <div className="text-[8px] text-zinc-400 truncate">{style.description}</div>
                </div>
                {selectedStyle === style.id && (
                  <div className="absolute top-2 right-2 rounded-full bg-cyan-500 p-0.5">
                    <Check className="size-2.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
