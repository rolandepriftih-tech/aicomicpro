"use client";

import { useState, useRef, useEffect, lazy, Suspense } from "react";
import {
  X,
  Wand2,
  Trash2,
  ImagePlus,
  Copy,
  Check,
  Type,
  FileText,
  Camera,
  Sparkles,
  Lock,
  Unlock,
  ScanFace,
  Loader2,
  Film,
} from "lucide-react";
import { showToast } from "./Toast";

// Lazy load the enhanced director elements panel
const DirectorElementsPanel = lazy(() => import("./DirectorElementsPanel"));

interface DetailPanelProps {
  open: boolean;
  nodeType: "asset" | "panel";
  nodeId: string;
  data: Record<string, unknown>;
  onClose: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onGenerate?: () => void;
  onDelete?: () => void;
  onExtractCharacter?: (imageBase64: string) => Promise<{ features?: string } | null>;
}

function compressToBase64(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

export default function DetailPanel({
  open,
  nodeType,
  nodeId,
  data,
  onClose,
  onUpdate,
  onGenerate,
  onDelete,
  onExtractCharacter,
}: DetailPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // 本地编辑状态
  const [localData, setLocalData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setLocalData({ ...data });
  }, [data, nodeId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  const isAsset = nodeType === "asset";
  const displayImage = (localData.imageUrl as string) || (localData.referenceImage as string);
  const isCharacter = isAsset && (localData.assetType as string) === "character";
  const isLocked = !!(localData.consistencyLock as boolean | undefined);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressToBase64(file, 1024, 0.8);
      setLocalData((prev) => ({ ...prev, referenceImage: base64 }));
      onUpdate({ referenceImage: base64 });
      showToast("success", "参考图已上传");
    } catch {
      showToast("error", "参考图上传失败");
    }
  };

  const handleCopyPrompt = () => {
    const prompt = (localData.englishImagePrompt as string) || (localData.description as string) || "";
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast("success", "已复制到剪贴板");
    });
  };

  const updateField = (key: string, value: unknown) => {
    setLocalData((prev) => ({ ...prev, [key]: value }));
    onUpdate({ [key]: value });
  };

  const handleExtractCharacter = async () => {
    const img = displayImage;
    if (!img || !onExtractCharacter) return;
    setExtracting(true);
    try {
      const result = await onExtractCharacter(img);
      if (result?.features) {
        updateField("consistencyPrompt", result.features);
        showToast("success", "角色特征已提取");
      } else {
        showToast("error", "未能提取角色特征");
      }
    } catch {
      showToast("error", "角色特征提取失败");
    } finally {
      setExtracting(false);
    }
  };

  const typeOptions = [
    { value: "character", label: "角色" },
    { value: "scene", label: "场景" },
    { value: "prop", label: "道具" },
    { value: "creature", label: "生物" },
    { value: "cockpit", label: "座舱" },
    { value: "custom", label: "自定义" },
  ];

  const inputBase = "w-full rounded-lg border border-zinc-800/60 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none transition-colors";
  const textareaBase = "w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none [scrollbar-color:theme(colors.zinc.700)_transparent] [scrollbar-width:thin] transition-colors";
  const labelBase = "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500";

  return (
    <div className="absolute inset-y-0 right-0 z-50 flex w-[440px] flex-col border-l border-zinc-800/40 glass-strong shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${isAsset ? "bg-indigo-950/60 text-indigo-300 ring-1 ring-indigo-500/20" : "bg-violet-950/60 text-violet-300 ring-1 ring-violet-500/20"}`}>
            {isAsset ? "资产详情" : "分镜详情"}
          </span>
          <span className="text-[11px] text-zinc-600 font-mono">{nodeId}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Image Preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-950/40">
          {displayImage ? (
            <img src={displayImage} alt="preview" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-zinc-600">
              <ImagePlus className="size-10 text-zinc-700" />
              <span>暂无图片</span>
            </div>
          )}
        </div>

        {/* Asset Form */}
        {isAsset && (
          <>
            <div className="space-y-1.5">
              <label className={labelBase}>
                <Type className="size-3" /> 名称
              </label>
              <input
                type="text"
                value={(localData.name as string) || ""}
                onChange={(e) => updateField("name", e.target.value)}
                className={inputBase}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelBase}>
                <Sparkles className="size-3" /> 类型
              </label>
              <select
                value={(localData.assetType as string) || "custom"}
                onChange={(e) => updateField("assetType", e.target.value)}
                className={inputBase}
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelBase}>
                <FileText className="size-3" /> 描述
              </label>
              <textarea
                value={(localData.description as string) || ""}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                className={textareaBase}
                placeholder="资产描述..."
              />
            </div>

            <div className="space-y-2.5">
              <label className={labelBase}>
                <ImagePlus className="size-3" /> 参考图
              </label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                >
                  <ImagePlus className="size-3.5" /> 上传参考图
                </button>
                {(localData.referenceImage as string) && (
                  <button
                    type="button"
                    onClick={() => {
                      updateField("referenceImage", undefined);
                      showToast("info", "参考图已清除");
                    }}
                    className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 hover:text-red-300 hover:bg-red-950/20 transition-colors"
                  >
                    清除
                  </button>
                )}
              </div>
              {(localData.referenceImage as string) && (
                <div className="relative aspect-square w-28 overflow-hidden rounded-lg border border-zinc-800/40">
                  <img src={localData.referenceImage as string} alt="reference" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {/* Character Consistency Section */}
            {isCharacter && (
              <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
                <div className="flex items-center gap-2">
                  <ScanFace className="size-4 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-300">角色一致性</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">锁定角色形象</span>
                  <button
                    type="button"
                    onClick={() => updateField("consistencyLock", !isLocked)}
                    className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors ${
                      isLocked
                        ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                        : "border-zinc-700/50 bg-zinc-900/60 text-zinc-500"
                    }`}
                  >
                    {isLocked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                    {isLocked ? "已锁定" : "未锁定"}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">一致性描述</span>
                    <button
                      type="button"
                      disabled={extracting || !displayImage}
                      onClick={handleExtractCharacter}
                      className="flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors disabled:opacity-40"
                    >
                      {extracting ? <Loader2 className="size-3 animate-spin" /> : <ScanFace className="size-3" />}
                      自动生成
                    </button>
                  </div>
                  <textarea
                    value={(localData.consistencyPrompt as string) || ""}
                    onChange={(e) => updateField("consistencyPrompt", e.target.value)}
                    rows={4}
                    className={textareaBase}
                    placeholder="描述角色的一致特征（发型、服装、五官等）..."
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Panel Form */}
        {!isAsset && (
          <>
            <div className="space-y-1.5">
              <label className={labelBase}>
                <Camera className="size-3" /> 分镜 ID
              </label>
              <input
                type="text"
                readOnly
                value={`#${(localData.panelId as number) || ""}`}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelBase}>
                <FileText className="size-3" /> Story Beat
              </label>
              <textarea
                value={(localData.storyBeat as string) || ""}
                onChange={(e) => updateField("storyBeat", e.target.value)}
                rows={3}
                className={textareaBase}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelBase}>
                <Sparkles className="size-3" /> 英文生图提示词
              </label>
              <textarea
                value={(localData.englishImagePrompt as string) || ""}
                onChange={(e) => updateField("englishImagePrompt", e.target.value)}
                rows={5}
                className={textareaBase}
                placeholder="English image prompt..."
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelBase}>
                <FileText className="size-3" /> 中文导演笔记
              </label>
              <textarea
                value={(localData.chineseDirectorNotes as string) || ""}
                onChange={(e) => updateField("chineseDirectorNotes", e.target.value)}
                rows={4}
                className={textareaBase}
                placeholder="导演笔记..."
              />
            </div>

            {/* 20元素电影工业级分镜编辑器 */}
            <div className="border border-violet-500/20 rounded-xl bg-violet-950/10 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Film className="size-4 text-violet-400" />
                <span className="text-xs font-semibold text-violet-300">20元素电影工业级分镜</span>
              </div>

              <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="size-6 animate-spin text-violet-400" /></div>}>
                <DirectorElementsPanel data={localData} onChange={updateField} />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-zinc-800/40 px-5 py-4 space-y-2.5">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onGenerate}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/20 transition-all active:scale-[0.98]"
          >
            <Wand2 className="size-3.5" /> 生图
          </button>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800/60 transition-colors"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            {copied ? "已复制" : "复制提示词"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onDelete?.();
            onClose();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-950/20 py-2.5 text-xs text-red-300 hover:bg-red-950/40 transition-colors"
        >
          <Trash2 className="size-3.5" /> 删除节点
        </button>
      </div>
    </div>
  );
}
