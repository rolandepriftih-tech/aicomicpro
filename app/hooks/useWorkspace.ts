"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  AnalyzeAssetsResponse,
  GenerateStoryboardResponse,
  StoryboardPanel,
} from "@/types/analyze";
import type { Plan4DirectorOutlineResponse, Plan4CanvasState } from "@/types/plan4";
import type {
  ImageAssetType,
  ImageReferenceMeta,
  ImageTaskType,
} from "@/lib/image-generation-types";
import type { ImageReferenceMode } from "@/lib/image-runtime-options";
import { LocalStorage, getAllAssetImages, saveAssetImages, clearAssetImages, getAllAssetReferenceImages, saveAssetReferenceImages, clearAssetReferenceImages, getAllPanelImages, savePanelImages, clearPanelImages, getAllPanelReferenceImages, savePanelReferenceImages, clearPanelReferenceImages } from "@/lib/storage";
import { matchAssets, extractAllAssetNames, resolveAssetReferenceImage } from "@/lib/asset-matcher";
import { DEFAULT_STYLE } from "@/lib/style-config";

const STORAGE_KEYS = {
  analysisResult: "ai-comic-pro:analysisResult",
  storyboardResult: "ai-comic-pro:storyboardResult",
  plan4Result: "ai-comic-pro:plan4Result",
  assetImageUrls: "ai-comic-pro:assetImageUrls",
  assetDescOverrides: "ai-comic-pro:assetDescOverrides",
  currentView: "ai-comic-pro:currentView",
  textBaseUrl: "ai-comic-pro:textBaseUrl",
  textApiKey: "ai-comic-pro:textApiKey",
  textProvider: "ai-comic-pro:textProvider",
  textModel: "ai-comic-pro:textModel",
  imageBaseUrl: "ai-comic-pro:imageBaseUrl",
  imageApiKey: "ai-comic-pro:imageApiKey",
  imageProvider: "ai-comic-pro:imageProvider",
  imageEngine: "ai-comic-pro:imageEngine",
  imageModel: "ai-comic-pro:imageModel",
  imageReferenceMode: "ai-comic-pro:imageReferenceMode",
  imageTimeoutMinutes: "ai-comic-pro:imageTimeoutMinutes",
  videoBaseUrl: "ai-comic-pro:videoBaseUrl",
  videoApiKey: "ai-comic-pro:videoApiKey",
  videoModel: "ai-comic-pro:videoModel",
  videoApiKeys: "ai-comic-pro:videoApiKeys",
  scriptPanelState: "ai-comic-pro:scriptPanelState",
  plan4Canvas: "ai-comic-pro:plan4Canvas",
  voiceApiKey: "ai-comic-pro:voiceApiKey",
  voiceProvider: "ai-comic-pro:voiceProvider",
  voiceModel: "ai-comic-pro:voiceModel",
  showVoicePanel: "ai-comic-pro:showVoicePanel",
} as const;

/**
 * 从 localStorage 恢复状态的辅助函数
 */
function restoreFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = LocalStorage.getRaw(key);
    if (stored === null || stored === undefined) return defaultValue;
    // 处理 boolean 类型
    if (typeof defaultValue === "boolean") {
      return (stored === "true") as T;
    }
    return stored as T;
  } catch (e) {
    console.error(`恢复 ${key} 失败:`, e);
    return defaultValue;
  }
}

function restoreJsonFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = LocalStorage.get<T>(key);
    return stored ?? defaultValue;
  } catch (e) {
    console.error(`恢复 ${key} 失败:`, e);
    return defaultValue;
  }
}

/**
 * 图片异步任务 jobId 持久化：
 * 生图轮询循环只活在页面内存里，刷新后循环消失，但服务端任务仍在执行。
 * 把 jobId 记到 localStorage，挂载时重新接上轮询，任务完成后图片自动落回节点。
 */
const IMAGE_JOBS_STORAGE_KEY = "ai-comic-pro:imageJobs";

type PendingImageJob = { jobId: string; startedAt: number };

function loadImageJobs(): Record<string, PendingImageJob> {
  return restoreJsonFromStorage<Record<string, PendingImageJob>>(IMAGE_JOBS_STORAGE_KEY, {});
}

function trackImageJob(assetName: string, jobId: string) {
  const map = loadImageJobs();
  map[assetName] = { jobId, startedAt: Date.now() };
  LocalStorage.set(IMAGE_JOBS_STORAGE_KEY, map);
}

function untrackImageJob(assetName: string) {
  const map = loadImageJobs();
  if (!(assetName in map)) return;
  delete map[assetName];
  LocalStorage.set(IMAGE_JOBS_STORAGE_KEY, map);
}

/**
 * 画布图片存取的 key 语义历史上混用过三种：data.name、完整节点 id（asset-{ts}）、
 * 去前缀 id（{ts}），早期删除逻辑还会漏清——IndexedDB 因此累积孤儿图。
 * 现行规则：画布节点的图只按节点 id（含去前缀兼容）读写；资产名 key 只属于
 * 左侧资产面板（与分析结果同名资产共享）。因此白名单 = 画布节点 id（含去前缀）
 * + 分析结果资产名；节点 data.name 不入白名单——名字不唯一（多个"新资产"），
 * 按名字入白名单会把同名残留 key 当合法数据保留，删除卡片后重建同名节点
 * 图片就会"复活"。
 */
function collectLiveAssetKeys(): Set<string> {
  const live = new Set<string>();
  const canvas = restoreJsonFromStorage<Plan4CanvasState | null>(STORAGE_KEYS.plan4Canvas, null);
  for (const n of canvas?.nodes ?? []) {
    live.add(n.id);
    if (n.id.startsWith("asset-")) live.add(n.id.slice(6));
  }
  const analysis = restoreJsonFromStorage<Parameters<typeof extractAllAssetNames>[0]>(STORAGE_KEYS.analysisResult, null);
  for (const name of extractAllAssetNames(analysis)) live.add(name);
  return live;
}

function collectLivePanelKeys(): Set<string> {
  const live = new Set<string>();
  const canvas = restoreJsonFromStorage<Plan4CanvasState | null>(STORAGE_KEYS.plan4Canvas, null);
  for (const n of canvas?.nodes ?? []) {
    live.add(n.id);
    const num = n.id.replace(/^panel-/, "");
    if (/^\d+$/.test(num)) live.add(`panel-${num}`);
    const pid = (n.data as unknown as Record<string, unknown> | undefined)?.panelId;
    if (typeof pid === "number") live.add(`panel-${pid}`);
  }
  const storyboard = restoreJsonFromStorage<{ panels?: Array<{ panelId: number }> } | null>(STORAGE_KEYS.storyboardResult, null);
  for (const p of storyboard?.panels ?? []) if (p?.panelId != null) live.add(`panel-${p.panelId}`);
  return live;
}

function pruneKeys<T extends Record<string, unknown>>(record: T, live: Set<string>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) if (live.has(k)) out[k] = v;
  return out as T;
}

/**
 * useWorkspace Hook - 工作台状态管理
 *
 * 封装了所有 useState、localStorage 持久化、API 调用逻辑
 */
export function useWorkspace() {
  // ==================== 状态定义 ====================

  // 业务数据状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeAssetsResponse | null>(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboardResult, setStoryboardResult] = useState<GenerateStoryboardResponse | null>(null);
  const [currentView, setCurrentView] = useState<"assets" | "storyboard" | "plan4" | "voice">("assets");
  const [generateStoryboardError, setGenerateStoryboardError] = useState<string | null>(null);

  // 资产状态
  const [assetImageUrls, setAssetImageUrls] = useState<Record<string, string>>({});
  const [assetDescOverrides, setAssetDescOverrides] = useState<Record<string, string>>({});
  const [assetReferenceImages, setAssetReferenceImages] = useState<Record<string, string>>({});
  const [generatingAssetName, setGeneratingAssetName] = useState<string | null>(null);
  const [generateImageError, setGenerateImageError] = useState<string | null>(null);

  // 分镜状态
  const [panelImageUrls, setPanelImageUrls] = useState<Record<string, string>>({});
  const [panelReferenceImages, setPanelReferenceImages] = useState<Record<string, string>>({});
  const [panelGenerationStatus, setPanelGenerationStatus] = useState<Record<string, "pending" | "generating" | "done" | "error">>({});
  const [storyboardAspectRatio, setStoryboardAspectRatio] = useState<string>("16:9");
  const [currentStyle, setCurrentStyle] = useState<string>(DEFAULT_STYLE);

  // 引擎配置状态
  const [textProvider, setTextProvider] = useState<"gemini" | "openai">("gemini");
  const [textModel, setTextModel] = useState("gemini-2.5-pro");
  const [textBaseUrl, setTextBaseUrl] = useState("https://api.openai.com/v1");
  const [textApiKey, setTextApiKey] = useState("");
  const [imageProvider, setImageProvider] = useState<"gemini" | "openai">("gemini");
  const [imageEngine, setImageEngine] = useState("nano-banana-2");
  const [imageModel, setImageModel] = useState("dall-e-3");
  const [imageBaseUrl, setImageBaseUrl] = useState("https://api.openai.com/v1");
  const [imageApiKey, setImageApiKey] = useState("");
  const [imageReferenceMode, setImageReferenceMode] = useState<ImageReferenceMode>("auto");
  const [imageTimeoutMinutes, setImageTimeoutMinutes] = useState(10);
  const [videoBaseUrl, setVideoBaseUrl] = useState("https://ark.cn-beijing.volces.com/api/plan/v3");
  const [videoApiKey, setVideoApiKey] = useState("");
  const [videoModel, setVideoModel] = useState("");

  // 多引擎 API Key（每个引擎独立存储）
  const [videoApiKeys, setVideoApiKeys] = useState<Record<string, string>>({
    autodl: "",
    ark: "",
    zizidonghua: "",
  });

  // 语音配置状态
  const [voiceApiKey, setVoiceApiKey] = useState("");
  const [voiceProvider, setVoiceProvider] = useState<"mimo" | "openai">("mimo");
  const [voiceModel, setVoiceModel] = useState("mimo-v2-tts");
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  // TTS 音频共享状态（base64 格式，供 VideoNode 使用）
  const [voiceAudioUrls, setVoiceAudioUrls] = useState<Record<string, string>>({});

  // 添加 TTS 音频到共享状态
  const handleVoiceGenerated = useCallback((panelId: string, audioUrl: string) => {
    // 如果是 blob URL，需要转换为 base64
    if (audioUrl.startsWith("blob:")) {
      fetch(audioUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            setVoiceAudioUrls((prev) => ({ ...prev, [panelId]: base64 }));
          };
          reader.readAsDataURL(blob);
        })
        .catch((err) => console.error("转换音频失败:", err));
    } else {
      // 已经是 base64 或其他格式
      setVoiceAudioUrls((prev) => ({ ...prev, [panelId]: audioUrl }));
    }
  }, []);

  // API 测试状态
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [testResult, setTestResult] = useState<{ text: boolean; image: boolean; msg: string } | null>(null);

  // 方案四状态
  const [plan4Result, setPlan4Result] = useState<Plan4DirectorOutlineResponse | null>(null);
  const [isGeneratingPlan4, setIsGeneratingPlan4] = useState(false);
  const [plan4Error, setPlan4Error] = useState<string | null>(null);
  const [plan4Canvas, setPlan4Canvas] = useState<Plan4CanvasState | null>(null);

  // Refs
  const batchAbortRef = useRef<AbortController | null>(null);
  const imageGenerationInFlightRef = useRef<Map<string, Promise<string>>>(new Map());
  const assetImagesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetReferenceImagesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelReferenceImagesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelImagesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==================== 初始化 (从 localStorage 恢复) ====================

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 恢复引擎配置
    setTextProvider(restoreFromStorage(STORAGE_KEYS.textProvider, "gemini"));
    setTextModel(restoreFromStorage(STORAGE_KEYS.textModel, "gemini-2.5-pro"));
    setImageProvider(restoreFromStorage(STORAGE_KEYS.imageProvider, "gemini"));
    setImageEngine(restoreFromStorage(STORAGE_KEYS.imageEngine, "nano-banana-2"));
    setImageModel(restoreFromStorage(STORAGE_KEYS.imageModel, "dall-e-3"));
    setImageTimeoutMinutes(Number(restoreFromStorage(STORAGE_KEYS.imageTimeoutMinutes, "10")) || 10);
    setTextBaseUrl(restoreFromStorage(STORAGE_KEYS.textBaseUrl, "https://api.openai.com/v1"));
    setTextApiKey(restoreFromStorage(STORAGE_KEYS.textApiKey, ""));
    setImageBaseUrl(restoreFromStorage(STORAGE_KEYS.imageBaseUrl, "https://api.openai.com/v1"));
    setImageApiKey(restoreFromStorage(STORAGE_KEYS.imageApiKey, ""));
    setVideoBaseUrl(restoreFromStorage(STORAGE_KEYS.videoBaseUrl, "https://ark.cn-beijing.volces.com/api/plan/v3"));
    setVideoApiKey(restoreFromStorage(STORAGE_KEYS.videoApiKey, ""));
    setVideoModel(restoreFromStorage(STORAGE_KEYS.videoModel, ""));
    setVideoApiKeys(restoreJsonFromStorage<Record<string, string>>(STORAGE_KEYS.videoApiKeys, { autodl: "", ark: "", zizidonghua: "" }));
    setVoiceApiKey(restoreFromStorage(STORAGE_KEYS.voiceApiKey, ""));
    setVoiceProvider(restoreFromStorage(STORAGE_KEYS.voiceProvider, "mimo") as "mimo" | "openai");
    setVoiceModel(restoreFromStorage(STORAGE_KEYS.voiceModel, "mimo-v2-tts"));
    setShowVoicePanel(restoreFromStorage<boolean>(STORAGE_KEYS.showVoicePanel, false));

    // 恢复 imageReferenceMode
    const storedRefMode = restoreFromStorage(STORAGE_KEYS.imageReferenceMode, "auto");
    if (["auto", "off", "image-edit"].includes(storedRefMode)) {
      setImageReferenceMode(storedRefMode as ImageReferenceMode);
    }

    // 恢复业务数据
    setAnalysisResult(restoreJsonFromStorage(STORAGE_KEYS.analysisResult, null));
    setAssetDescOverrides(restoreJsonFromStorage(STORAGE_KEYS.assetDescOverrides, {}));
    setStoryboardResult(restoreJsonFromStorage(STORAGE_KEYS.storyboardResult, null));
    setPlan4Result(restoreJsonFromStorage(STORAGE_KEYS.plan4Result, null));
    setPlan4Canvas(restoreJsonFromStorage(STORAGE_KEYS.plan4Canvas, null));

    const storedView = restoreFromStorage(STORAGE_KEYS.currentView, "assets");
    if (["assets", "storyboard", "plan4", "voice"].includes(storedView)) {
      setCurrentView(storedView as "assets" | "storyboard" | "plan4" | "voice");
    }

    // 异步从 IndexedDB 恢复图片；恢复后按白名单对账，清掉已删节点的孤儿图
    void (async () => {
      const liveAssets = collectLiveAssetKeys();
      const livePanels = collectLivePanelKeys();

      const imgs = await getAllAssetImages().catch(() => ({}) as Record<string, string>);
      const prunedImgs = pruneKeys(imgs, liveAssets);
      if (Object.keys(prunedImgs).length !== Object.keys(imgs).length) {
        console.log("[useWorkspace] 对账清扫 asset-images 孤儿:", Object.keys(imgs).length, "->", Object.keys(prunedImgs).length);
        await (Object.keys(prunedImgs).length > 0 ? saveAssetImages(prunedImgs) : clearAssetImages()).catch((e) => console.error("清扫 asset-images 失败:", e));
      }
      if (Object.keys(prunedImgs).length > 0) setAssetImageUrls(prunedImgs);

      const refs = await getAllAssetReferenceImages().catch(() => ({}) as Record<string, string>);
      const prunedRefs = pruneKeys(refs, liveAssets);
      if (Object.keys(prunedRefs).length !== Object.keys(refs).length) {
        console.log("[useWorkspace] 对账清扫 asset-reference-images 孤儿:", Object.keys(refs).length, "->", Object.keys(prunedRefs).length);
        await (Object.keys(prunedRefs).length > 0 ? saveAssetReferenceImages(prunedRefs) : clearAssetReferenceImages()).catch((e) => console.error("清扫 asset-reference-images 失败:", e));
      }
      if (Object.keys(prunedRefs).length > 0) setAssetReferenceImages(prunedRefs);

      const panels = await getAllPanelImages().catch(() => ({}) as Record<string, string>);
      const prunedPanels = pruneKeys(panels, livePanels);
      if (Object.keys(prunedPanels).length !== Object.keys(panels).length) {
        console.log("[useWorkspace] 对账清扫 panel-images 孤儿:", Object.keys(panels).length, "->", Object.keys(prunedPanels).length);
        await (Object.keys(prunedPanels).length > 0 ? savePanelImages(prunedPanels) : clearPanelImages()).catch((e) => console.error("清扫 panel-images 失败:", e));
      }
      if (Object.keys(prunedPanels).length > 0) setPanelImageUrls(prunedPanels);

      const panelRefs = await getAllPanelReferenceImages().catch(() => ({}) as Record<string, string>);
      const prunedPanelRefs = pruneKeys(panelRefs, livePanels);
      if (Object.keys(prunedPanelRefs).length !== Object.keys(panelRefs).length) {
        console.log("[useWorkspace] 对账清扫 panel-reference-images 孤儿:", Object.keys(panelRefs).length, "->", Object.keys(prunedPanelRefs).length);
        await (Object.keys(prunedPanelRefs).length > 0 ? savePanelReferenceImages(prunedPanelRefs) : clearPanelReferenceImages()).catch((e) => console.error("清扫 panel-reference-images 失败:", e));
      }
      if (Object.keys(prunedPanelRefs).length > 0) setPanelReferenceImages(prunedPanelRefs);
    })().catch((e) => console.error("恢复图片存储失败:", e));
  }, []);

  // ==================== 持久化逻辑 ====================

  // analysisResult 持久化
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (analysisResult) {
      LocalStorage.set(STORAGE_KEYS.analysisResult, analysisResult);
    } else {
      LocalStorage.remove(STORAGE_KEYS.analysisResult);
    }
  }, [analysisResult]);

  // storyboardResult 持久化
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (storyboardResult) {
      LocalStorage.set(STORAGE_KEYS.storyboardResult, storyboardResult);
    } else {
      LocalStorage.remove(STORAGE_KEYS.storyboardResult);
    }
  }, [storyboardResult]);

  // plan4Result 持久化
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (plan4Result) {
      LocalStorage.set(STORAGE_KEYS.plan4Result, plan4Result);
    } else {
      LocalStorage.remove(STORAGE_KEYS.plan4Result);
    }
  }, [plan4Result]);

  // plan4Canvas 持久化
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (plan4Canvas) {
      const clean: Plan4CanvasState = {
        ...plan4Canvas,
        nodes: plan4Canvas.nodes.map((n) => {
          const rest = { ...(n.data as unknown as Record<string, unknown>) };
          delete rest.imageUrl;
          delete rest.referenceImage;
          return { ...n, data: rest as unknown as typeof n.data };
        }),
      };
      LocalStorage.set(STORAGE_KEYS.plan4Canvas, clean);
    } else {
      LocalStorage.remove(STORAGE_KEYS.plan4Canvas);
    }
  }, [plan4Canvas]);

  // assetDescOverrides 持久化
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (assetDescOverrides && Object.keys(assetDescOverrides).length > 0) {
      LocalStorage.set(STORAGE_KEYS.assetDescOverrides, assetDescOverrides);
    } else {
      LocalStorage.remove(STORAGE_KEYS.assetDescOverrides);
    }
  }, [assetDescOverrides]);

  // assetImageUrls 持久化 (IndexedDB)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (assetImagesSaveTimerRef.current) clearTimeout(assetImagesSaveTimerRef.current);
    assetImagesSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          if (assetImageUrls && Object.keys(assetImageUrls).length > 0) {
            await saveAssetImages(assetImageUrls);
          } else {
            await clearAssetImages();
          }
        } catch (e) {
          console.error("持久化 assetImageUrls 失败:", e);
        }
      })();
    }, 650);
    return () => {
      if (assetImagesSaveTimerRef.current) clearTimeout(assetImagesSaveTimerRef.current);
    };
  }, [assetImageUrls]);

  // assetReferenceImages 持久化 (IndexedDB)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (assetReferenceImagesSaveTimerRef.current) clearTimeout(assetReferenceImagesSaveTimerRef.current);
    assetReferenceImagesSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          if (assetReferenceImages && Object.keys(assetReferenceImages).length > 0) {
            await saveAssetReferenceImages(assetReferenceImages);
          } else {
            await clearAssetReferenceImages();
          }
        } catch (e) {
          console.error("持久化 assetReferenceImages 失败:", e);
        }
      })();
    }, 650);
    return () => {
      if (assetReferenceImagesSaveTimerRef.current) clearTimeout(assetReferenceImagesSaveTimerRef.current);
    };
  }, [assetReferenceImages]);

  // panelImageUrls 持久化 (IndexedDB)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (panelImagesSaveTimerRef.current) clearTimeout(panelImagesSaveTimerRef.current);
    panelImagesSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          if (panelImageUrls && Object.keys(panelImageUrls).length > 0) {
            await savePanelImages(panelImageUrls);
          } else {
            await clearPanelImages();
          }
        } catch (e) {
          console.error("持久化 panelImageUrls 失败:", e);
        }
      })();
    }, 650);
    return () => {
      if (panelImagesSaveTimerRef.current) clearTimeout(panelImagesSaveTimerRef.current);
    };
  }, [panelImageUrls]);

  // panelReferenceImages 持久化 (IndexedDB)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (panelReferenceImagesSaveTimerRef.current) clearTimeout(panelReferenceImagesSaveTimerRef.current);
    panelReferenceImagesSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          if (panelReferenceImages && Object.keys(panelReferenceImages).length > 0) {
            await savePanelReferenceImages(panelReferenceImages);
          } else {
            await clearPanelReferenceImages();
          }
        } catch (e) {
          console.error("持久化 panelReferenceImages 失败:", e);
        }
      })();
    }, 650);
    return () => {
      if (panelReferenceImagesSaveTimerRef.current) clearTimeout(panelReferenceImagesSaveTimerRef.current);
    };
  }, [panelReferenceImages]);

  // currentView 持久化
  useEffect(() => {
    if (typeof window === "undefined") return;
    LocalStorage.setRaw(STORAGE_KEYS.currentView, currentView);
  }, [currentView]);

  // 引擎配置持久化
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.textBaseUrl, textBaseUrl); }, [textBaseUrl]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.textApiKey, textApiKey); }, [textApiKey]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageBaseUrl, imageBaseUrl); }, [imageBaseUrl]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageApiKey, imageApiKey); }, [imageApiKey]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.videoBaseUrl, videoBaseUrl); }, [videoBaseUrl]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.videoApiKey, videoApiKey); }, [videoApiKey]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.videoModel, videoModel); }, [videoModel]);
  // videoApiKeys（每引擎 Key）持久化：刷新/重启不丢
  useEffect(() => {
    if (typeof window === "undefined") return;
    LocalStorage.set(STORAGE_KEYS.videoApiKeys, videoApiKeys);
  }, [videoApiKeys]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.textProvider, textProvider); }, [textProvider]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.textModel, textModel); }, [textModel]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageProvider, imageProvider); }, [imageProvider]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageEngine, imageEngine); }, [imageEngine]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageModel, imageModel); }, [imageModel]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageReferenceMode, imageReferenceMode); }, [imageReferenceMode]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.imageTimeoutMinutes, String(imageTimeoutMinutes)); }, [imageTimeoutMinutes]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.voiceApiKey, voiceApiKey); }, [voiceApiKey]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.voiceProvider, voiceProvider); }, [voiceProvider]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.voiceModel, voiceModel); }, [voiceModel]);
  useEffect(() => { if (typeof window !== "undefined") LocalStorage.setRaw(STORAGE_KEYS.showVoicePanel, String(showVoicePanel)); }, [showVoicePanel]);

  // ==================== 辅助函数 ====================

  const enrichAssets = useCallback(
    <T extends { name: string; description?: string }>(assets: T[] | undefined) => {
      if (!assets) return [];
      return assets.map((asset) => ({
        ...asset,
        description: assetDescOverrides[asset.name] ?? asset.description,
        imageUrl: assetImageUrls[asset.name],
      }));
    },
    [assetDescOverrides, assetImageUrls]
  );

  // ==================== API 调用 ====================

  const handleAnalyze = useCallback(
    async (payload: {
      script: string;
      apiKey: string;
      mode: 1 | 2 | 3;
      textModel?: string;
      style?: string;
      referenceImages?: string[];
    }) => {
      setIsAnalyzing(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: payload.script,
            apiKey: payload.apiKey,
            mode: payload.mode,
            textProvider,
            textModel: payload.textModel ?? textModel,
            baseUrl: textBaseUrl || undefined,
            style: payload.style,
            referenceImages: payload.referenceImages,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as
          | AnalyzeAssetsResponse
          | { error?: string; message?: string; details?: string };
        if (!res.ok) {
          const errorData = data as { error?: string; message?: string; details?: string };
          const msg = errorData.error ?? errorData.message ?? `请求失败 ${res.status}`;
          const detail = errorData.details ? `\n${errorData.details}` : "";
          throw new Error(`${msg}${detail}`);
        }
        // 分析成功后清空旧数据，换剧本从零开始
        setAssetImageUrls({});
        setAssetDescOverrides({});
        setAssetReferenceImages({});
        setStoryboardResult(null);
        setPanelImageUrls({});
        setAnalysisResult(data as AnalyzeAssetsResponse);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [textProvider, textModel, textBaseUrl]
  );

  const handleGenerateStoryboard = useCallback(
    async (payload: {
      script: string;
      apiKey: string;
      mode: 1 | 2 | 3;
      aspectRatio?: string;
      textModel?: string;
      style?: string;
    }) => {
      setGenerateStoryboardError(null);
      if (!analysisResult) {
        setGenerateStoryboardError("请先完成「深度分析剧本提取资产」");
        return;
      }
      setStoryboardAspectRatio(payload.aspectRatio ?? "16:9");
      setIsGeneratingStoryboard(true);
      try {
        const lockedAssetsPayload = {
          ...analysisResult,
          characters: enrichAssets(analysisResult.characters),
          creatures: enrichAssets(analysisResult.creatures),
          scenes: enrichAssets(analysisResult.scenes),
          props: enrichAssets(analysisResult.props),
          cockpits: enrichAssets(analysisResult.cockpits ?? []),
        };

        const res = await fetch("/api/generate-storyboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: payload.script,
            lockedAssets: lockedAssetsPayload,
            mode: payload.mode,
            apiKey: payload.apiKey,
            aspectRatio: payload.aspectRatio ?? "16:9",
            textProvider,
            textModel: payload.textModel ?? textModel,
            baseUrl: textBaseUrl || undefined,
            style: payload.style,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as
          | GenerateStoryboardResponse
          | { error?: string; message?: string; details?: string };
        if (!res.ok) {
          const errorData = data as { error?: string; message?: string; details?: string };
          const msg = errorData.error ?? errorData.message ?? `请求失败 ${res.status}`;
          const detail = errorData.details ? `\n${errorData.details}` : "";
          throw new Error(`${msg}${detail}`);
        }
        // 重新生成分镜时清空旧分镜图，避免创建/导入分镜时带出旧图
        setPanelImageUrls({});
        setStoryboardResult(data as GenerateStoryboardResponse);
        setCurrentView("storyboard");
      } catch (e) {
        setGenerateStoryboardError(e instanceof Error ? e.message : "生成分镜失败");
      } finally {
        setIsGeneratingStoryboard(false);
      }
    },
    [analysisResult, textProvider, textModel, textBaseUrl, enrichAssets]
  );

  const handlePlan4DirectorOutline = useCallback(
    async (payload: {
      script: string;
      apiKey: string;
      aspectRatio?: string;
      textModel?: string;
      style?: string;
    }) => {
      setPlan4Error(null);
      if (!analysisResult) {
        setPlan4Error("请先完成「深度分析剧本提取资产」");
        return;
      }
      setStoryboardAspectRatio(payload.aspectRatio ?? "16:9");
      setIsGeneratingPlan4(true);
      try {
        const lockedAssetsPayload = {
          ...analysisResult,
          characters: enrichAssets(analysisResult.characters),
          creatures: enrichAssets(analysisResult.creatures),
          scenes: enrichAssets(analysisResult.scenes),
          props: enrichAssets(analysisResult.props),
          cockpits: enrichAssets(analysisResult.cockpits ?? []),
        };

        const res = await fetch("/api/plan4/director-outline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: payload.script,
            lockedAssets: lockedAssetsPayload,
            apiKey: payload.apiKey,
            aspectRatio: payload.aspectRatio ?? "16:9",
            textProvider,
            textModel: payload.textModel ?? textModel,
            baseUrl: textBaseUrl || undefined,
            style: payload.style,
          }),
        });
        const raw = (await res.json().catch(() => ({}))) as unknown;
        if (!res.ok) {
          const err = raw as { error?: string; message?: string; details?: string };
          const msg = err.error ?? err.message ?? `请求失败 ${res.status}`;
          const detail = err.details ? `\n${err.details}` : "";
          throw new Error(`${msg}${detail}`);
        }
        setPlan4Result(raw as Plan4DirectorOutlineResponse);
        setCurrentView("plan4");
      } catch (e) {
        setPlan4Error(e instanceof Error ? e.message : "方案四导演大纲生成失败");
      } finally {
        setIsGeneratingPlan4(false);
      }
    },
    [analysisResult, textProvider, textModel, textBaseUrl, enrichAssets]
  );

  const handleTestAPI = useCallback(async () => {
    setIsTestingAPI(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textProvider, textModel, textBaseUrl: textBaseUrl || undefined, textApiKey: textApiKey.trim() || undefined,
          imageProvider, imageEngine, imageModel, imageBaseUrl: imageBaseUrl || undefined, imageApiKey: imageApiKey.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({ text: Boolean(data?.textSuccess), image: Boolean(data?.imageSuccess), msg: data?.message || data?.error || "" });
    } catch {
      setTestResult({ text: false, image: false, msg: "网络请求彻底失败" });
    } finally {
      setIsTestingAPI(false);
    }
  }, [textProvider, textModel, textBaseUrl, textApiKey, imageProvider, imageEngine, imageModel, imageBaseUrl, imageApiKey]);

  const handleGenerateImage = useCallback(
    async (
      assetName: string,
      prompt: string,
      referenceImage?: string,
      referenceImages?: string[],
      overrideStyle?: string,
      taskType: ImageTaskType = assetName.startsWith("panel-") ? "panel-storyboard" : "asset-custom",
      assetType?: ImageAssetType,
      referenceMetas?: ImageReferenceMeta[]
    ) => {
      if (!imageApiKey?.trim()) {
        setGenerateImageError("请先填写视觉引擎的 API Key");
        throw new Error("请先填写视觉引擎的 API Key");
      }
      const requestKey = JSON.stringify({ assetName, prompt, referenceImage, referenceImages, overrideStyle, taskType, assetType, referenceMetas, imageProvider, imageEngine, imageModel, imageBaseUrl, storyboardAspectRatio, currentStyle, imageReferenceMode });
      const existing = imageGenerationInFlightRef.current.get(requestKey);
      if (existing) return existing;
      setGenerateImageError(null);
      setGeneratingAssetName(assetName);
      const task = (async () => {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt, assetName, apiKey: imageApiKey.trim(), imageProvider, imageEngine, imageModel, baseUrl: imageBaseUrl || undefined,
            aspectRatio: storyboardAspectRatio, style: overrideStyle ?? currentStyle, taskType, assetType, referenceImage, referenceImages, referenceMetas,
            referenceMode: imageReferenceMode, timeoutMs: imageTimeoutMinutes * 60_000, async: true,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; imageUrl?: string; jobId?: string; status?: "pending" | "success" | "error"; error?: string };

        let imageUrl = data.imageUrl;
        if (res.ok && data.jobId && !imageUrl) {
          const startedAt = Date.now();
          // 轮询容错：网络抖动/服务瞬时 5xx 只退避重试，连续失败才判死；
          // 404（任务记录丢失）是终态，立即失败（与视频侧 consecutiveFailures 策略一致）
          const POLL_FAILURE_LIMIT = 5;
          let pollFailures = 0;
          while (Date.now() - startedAt < 15 * 60_000) {
            await new Promise((resolve) =>
              setTimeout(resolve, pollFailures > 0 ? Math.min(2000 * (pollFailures + 1), 10_000) : 2000)
            );
            let job: { success?: boolean; status?: "pending" | "success" | "error"; imageUrl?: string; error?: string; errorKind?: string } | undefined;
            let transientFailure = false;
            try {
              const jobRes = await fetch(`/api/generate-image?jobId=${encodeURIComponent(data.jobId)}`);
              job = (await jobRes.json().catch(() => ({}))) as typeof job;
              // 非 404 的失败（5xx/网关抖动）可重试
              transientFailure = !jobRes.ok && jobRes.status !== 404;
            } catch {
              transientFailure = true; // fetch 网络异常
            }
            if (transientFailure) {
              pollFailures += 1;
              if (pollFailures >= POLL_FAILURE_LIMIT) {
                throw new Error("查询生图任务连续失败（网络/服务异常），请稍后重试");
              }
              continue;
            }
            pollFailures = 0;
            if (!job) {
              throw new Error("生图任务记录丢失，通常是开发服务热更新/重启导致。请刷新页面后重新生成。");
            }
            if (job.status === "success" && job.imageUrl) { imageUrl = job.imageUrl; break; }
            if (job.status === "error") throw new Error(job.error ?? "生图任务失败");
          }
          if (!imageUrl) throw new Error("生图任务仍在后台处理中，请稍后在日志中查看结果。");
        }
        if (!res.ok || !data.success || !imageUrl) throw new Error(data?.error ?? "生成失败");

        let finalUrl = imageUrl;
        if (finalUrl.startsWith("http://") || finalUrl.startsWith("https://")) {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 15_000);
          try {
            const imgRes = await fetch(finalUrl, { signal: controller.signal });
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              const reader = new FileReader();
              finalUrl = await new Promise<string>((resolve, reject) => { reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); });
            }
          } catch { /* 下载失败仍使用原始 URL */ } finally { window.clearTimeout(timer); }
        }

        if (assetName.startsWith("panel-")) {
          setPanelImageUrls((prev) => ({ ...prev, [assetName]: finalUrl }));
        } else {
          setAssetImageUrls((prev) => ({ ...prev, [assetName]: finalUrl }));
        }
        return finalUrl;
      })();

      imageGenerationInFlightRef.current.set(requestKey, task);
      try { return await task; } catch (e) {
        const msg = e instanceof Error ? e.message : "生成失败";
        setGenerateImageError(msg);
        throw e;
      } finally {
        imageGenerationInFlightRef.current.delete(requestKey);
        setGeneratingAssetName(null);
      }
    },
    [imageApiKey, imageProvider, imageEngine, imageModel, imageBaseUrl, storyboardAspectRatio, currentStyle, imageReferenceMode, imageTimeoutMinutes]
  );

  const handleBatchGenerateImages = useCallback(
    async (panels: StoryboardPanel[], concurrency = 3, onProgress?: (done: number, total: number) => void, signal?: AbortSignal) => {
      if (!imageApiKey?.trim()) { setGenerateImageError("请先填写视觉引擎的 API Key"); return; }
      if (!panels.length) return;
      setGenerateImageError(null);
      const allAssetNames = extractAllAssetNames(analysisResult);
      const total = panels.length;
      let doneCount = 0;
      setPanelGenerationStatus((prev) => {
        const next = { ...prev };
        for (const panel of panels) next[`panel-${panel.panelId}`] = "pending";
        return next;
      });

      const runTask = async (panel: StoryboardPanel) => {
        const panelKey = `panel-${panel.panelId}`;
        if (signal?.aborted) return;
        setPanelGenerationStatus((prev) => ({ ...prev, [panelKey]: "generating" }));
        const matched = matchAssets(panel.assetsUsed ?? [], allAssetNames);
        const referenceImages: string[] = [];
        for (const name of matched) {
          const img = resolveAssetReferenceImage(name, assetReferenceImages, assetImageUrls);
          if (img && !referenceImages.includes(img)) referenceImages.push(img);
        }
        try {
          await handleGenerateImage(panelKey, panel.englishImagePrompt ?? panel.chineseDirectorNotes ?? "", referenceImages[0], referenceImages.length > 1 ? referenceImages : undefined);
          if (signal?.aborted) return;
          setPanelGenerationStatus((prev) => ({ ...prev, [panelKey]: "done" }));
          doneCount++;
          onProgress?.(doneCount, total);
        } catch {
          if (signal?.aborted) return;
          setPanelGenerationStatus((prev) => ({ ...prev, [panelKey]: "error" }));
          doneCount++;
          onProgress?.(doneCount, total);
        }
      };

      for (let i = 0; i < panels.length; i += concurrency) {
        if (signal?.aborted) break;
        const batch = panels.slice(i, i + concurrency);
        await Promise.all(batch.map((panel) => runTask(panel)));
      }
    },
    [imageApiKey, analysisResult, assetReferenceImages, assetImageUrls, handleGenerateImage]
  );

  const handleModifyPanel = useCallback(
    async (panel: StoryboardPanel, instruction: string) => {
      if (!textApiKey.trim()) throw new Error("请先在左侧配置有效的文本引擎 API Key。");
      const res = await fetch("/api/modify-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelData: panel, instruction, apiKey: textApiKey.trim(), textProvider, textModel, baseUrl: textBaseUrl || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; updatedPanel?: StoryboardPanel; error?: string; message?: string };
      if (!res.ok || !data.success || !data.updatedPanel) throw new Error(data?.error ?? data?.message ?? `请求失败 ${res.status}`);
      setStoryboardResult((prev) => {
        if (!prev || !prev.panels) return prev;
        return { ...prev, panels: prev.panels.map((p) => p.panelId === panel.panelId ? data.updatedPanel! : p) };
      });
    },
    [textApiKey, textProvider, textModel, textBaseUrl]
  );

  const handleReset = useCallback(() => {
    setAnalysisResult(null);
    setStoryboardResult(null);
    setPlan4Result(null);
    setPlan4Canvas(null);
    setCurrentView("assets");
    setGenerateStoryboardError(null);
    setPlan4Error(null);
    setAssetImageUrls({});
    setGeneratingAssetName(null);
    setGenerateImageError(null);
    setAssetDescOverrides({});
    setAssetReferenceImages({});
    setPanelImageUrls({});
    if (typeof window !== "undefined") {
      try {
        LocalStorage.remove(STORAGE_KEYS.analysisResult);
        LocalStorage.remove(STORAGE_KEYS.storyboardResult);
        LocalStorage.remove(STORAGE_KEYS.plan4Result);
        LocalStorage.remove(STORAGE_KEYS.plan4Canvas);
        LocalStorage.remove(STORAGE_KEYS.assetDescOverrides);
        LocalStorage.remove(STORAGE_KEYS.currentView);
        LocalStorage.remove(STORAGE_KEYS.scriptPanelState);
        clearAssetImages().catch((e) => console.error("清空图片缓存失败:", e));
        clearAssetReferenceImages().catch((e) => console.error("清空参考图缓存失败:", e));
        clearPanelImages().catch((e) => console.error("清空分镜图片缓存失败:", e));
      } catch (e) { console.error("清理本地缓存失败:", e); }
    }
  }, []);

  const handleAssetDescriptionChange = useCallback((assetName: string, description: string) => {
    setAssetDescOverrides((prev) => {
      const next = { ...prev };
      const trimmed = description.trim();
      if (!trimmed) { delete next[assetName]; } else { next[assetName] = trimmed; }
      return next;
    });
  }, []);

  const handleAssetReferenceImageChange = useCallback((assetName: string, referenceImage: string | null) => {
    setAssetReferenceImages((prev) => {
      const next = { ...prev };
      if (referenceImage === null || referenceImage === undefined) { delete next[assetName]; } else { next[assetName] = referenceImage; }
      return next;
    });
  }, []);

  const handleRefineAsset = useCallback(
    async (assetName: string, instruction: string): Promise<string> => {
      const currentDesc = assetDescOverrides[assetName] ?? analysisResult?.characters.find((c) => c.name === assetName)?.description ?? analysisResult?.creatures.find((c) => c.name === assetName)?.description ?? analysisResult?.scenes.find((s) => s.name === assetName)?.description ?? analysisResult?.props.find((p) => p.name === assetName)?.description ?? analysisResult?.cockpits?.find((c) => c.name === assetName)?.description ?? "";
      const assetType = analysisResult?.characters.find((c) => c.name === assetName) ? "角色" : analysisResult?.creatures.find((c) => c.name === assetName) ? "生物" : analysisResult?.scenes.find((s) => s.name === assetName) ? "场景" : analysisResult?.props.find((p) => p.name === assetName) ? "道具" : analysisResult?.cockpits?.find((c) => c.name === assetName) ? "座舱" : "资产";
      const res = await fetch("/api/refine-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetName, assetType, description: currentDesc, instruction, style: currentStyle, apiKey: textApiKey.trim(), textProvider, textModel, baseUrl: textBaseUrl || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; description?: string; error?: string };
      if (!res.ok || !data.success || !data.description) throw new Error(data?.error ?? "改写失败");
      setAssetDescOverrides((prev) => ({ ...prev, [assetName]: data.description! }));
      return data.description!;
    },
    [analysisResult, assetDescOverrides, currentStyle, textApiKey, textProvider, textModel, textBaseUrl]
  );

  const handleVideoPromptChange = useCallback((panelId: number, videoPrompt: string) => {
    setStoryboardResult((prev) => {
      if (!prev || !prev.panels) return prev;
      return { ...prev, panels: prev.panels.map((p) => p.panelId === panelId ? { ...p, videoPrompt } : p) };
    });
  }, []);

  const handleCancelBatch = useCallback(() => {
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
  }, []);

  const handleCanvasGenerate = useCallback(
    async (nodeId: string, prompt: string, referenceImages?: string[], style?: string, taskType?: ImageTaskType, assetType?: ImageAssetType, referenceMetas?: ImageReferenceMeta[]) => {
      const assetName = nodeId.startsWith("asset-") ? nodeId.slice(6) : nodeId;
      const url = await handleGenerateImage(assetName, prompt, undefined, referenceImages, style, taskType, assetType, referenceMetas);
      if (url) {
        if (nodeId.startsWith("asset-")) setAssetImageUrls((prev) => ({ ...prev, [nodeId]: url }));
        else if (nodeId.startsWith("panel-")) setPanelImageUrls((prev) => ({ ...prev, [nodeId]: url }));
      }
      return url;
    },
    [handleGenerateImage]
  );

  const handlePanelReferenceImageChange = useCallback((panelId: string, image: string | null) => {
    setPanelReferenceImages((prev) => {
      const next = { ...prev };
      if (image === null || image === undefined) { delete next[panelId]; } else { next[panelId] = image; }
      return next;
    });
  }, []);

  const handleClearPanelImage = useCallback((panelId: string) => {
    console.log("[useWorkspace] 清除分镜图片:", panelId);
    setPanelImageUrls((prev) => {
      const next = { ...prev };
      console.log("[useWorkspace] 删除前 panelImageUrls keys:", Object.keys(next));
      delete next[panelId];
      console.log("[useWorkspace] 删除后 panelImageUrls keys:", Object.keys(next));

      // 立即保存到 IndexedDB，避免刷新后恢复
      void (async () => {
        try {
          if (Object.keys(next).length > 0) {
            await savePanelImages(next);
          } else {
            await clearPanelImages();
          }
        } catch (e) {
          console.error("立即保存 panelImageUrls 失败:", e);
        }
      })();

      return next;
    });
  }, []);

  const handleClearAssetImage = useCallback((assetName: string | string[]) => {
    const keys = Array.isArray(assetName) ? assetName : [assetName];
    if (keys.length === 0) return;
    console.log("[useWorkspace] 清除资产图片:", keys);
    // 纯 state 更新，一次清掉全部 key（资产名 + 节点 id 双 key 是同一张图）。
    // 持久化统一交给下方 [assetImageUrls] 防抖 effect 落盘最终态——
    // 不可在 updater 内做 IndexedDB 副作用：多次清理时异步事务落盘顺序
    // 不保证，会把已删除的 key 残留回 IndexedDB，刷新后图片"复活"。
    setAssetImageUrls((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }, []);

  return {
    // 业务数据
    isAnalyzing, analysisResult, isGeneratingStoryboard, storyboardResult,
    currentView, generateStoryboardError,
    // 资产
    assetImageUrls, assetDescOverrides, assetReferenceImages,
    generatingAssetName, generateImageError,
    // 分镜
    panelImageUrls, panelGenerationStatus, storyboardAspectRatio, currentStyle,
    // 引擎配置
    textProvider, textModel, textBaseUrl, textApiKey,
    imageProvider, imageEngine, imageModel, imageBaseUrl, imageApiKey, imageReferenceMode, imageTimeoutMinutes,
    videoBaseUrl, videoApiKey, videoModel,
    // 语音配置
    voiceApiKey, voiceProvider, voiceModel, showVoicePanel, voiceAudioUrls,
    // API 测试
    isTestingAPI, testResult,
    // 方案四
    plan4Result, isGeneratingPlan4, plan4Error, plan4Canvas,
    // Setters
    setCurrentView, setTextProvider, setTextModel, setTextBaseUrl, setTextApiKey,
    setImageProvider, setImageEngine, setImageModel, setImageBaseUrl, setImageApiKey,
    setImageReferenceMode, setImageTimeoutMinutes,
    setVideoBaseUrl, setVideoApiKey, setVideoModel, videoApiKeys, setVideoApiKeys,
    setVoiceApiKey, setVoiceProvider, setVoiceModel, setShowVoicePanel,
    setCurrentStyle, setStoryboardAspectRatio,
    setPlan4Canvas,
    setAssetImageUrls, setPanelImageUrls,
    // Actions
    handleAnalyze, handleGenerateStoryboard, handlePlan4DirectorOutline,
    handleTestAPI, handleGenerateImage, handleBatchGenerateImages,
    handleModifyPanel, handleReset,
    handleAssetDescriptionChange, handleAssetReferenceImageChange, handleRefineAsset,
    handleVideoPromptChange, handleCancelBatch,
    handleCanvasGenerate, handleClearPanelImage, handleClearAssetImage,
    handlePanelReferenceImageChange, panelReferenceImages,
    handleVoiceGenerated,
  };
}
