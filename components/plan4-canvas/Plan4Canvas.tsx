"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./xyq-theme.css";
import type {
  AnalyzeAssetsResponse,
  GenerateStoryboardResponse,
} from "@/types/analyze";
import type {
  Plan4DirectorOutlineResponse,
  Plan4CanvasState,
} from "@/types/plan4";
import type {
  ImageAssetType,
  ImageReferenceMeta,
  ImageTaskType,
} from "@/lib/image-generation-types";
import {
  addReferenceImage,
  collectConnectedReferenceItems,
  hasContinuesInput,
  normalizeReferenceType,
  resolveNodeTaskType,
} from "./utils/generation";
import { DEFAULT_STYLE, STYLE_CONFIGS } from "@/lib/style-config";
import { extractVideoTaskId } from "@/lib/video-url";
import AssetNodeComponent from "./AssetNode";
import PanelNodeComponent from "./PanelNode";
import StyleNodeComponent from "./StyleNode";
import StyleLibrary from "./StyleLibrary";
import VideoNodeComponent from "./VideoNode";
import CustomEdge from "./CustomEdge";
import CanvasToolbar from "./CanvasToolbar";
import ImportDialog from "./ImportDialog";
import ConfirmDialog from "./ConfirmDialog";
import CreatePanelDialog from "./CreatePanelDialog";
import DetailPanel from "./DetailPanel";
import ImageEditDialog from "./ImageEditDialog";
import VariantDialog from "./VariantDialog";
import GenerationModePanel from "./GenerationModePanel";
import { ToastContainer, showToast } from "./Toast";
import type { GenerationMode } from "./generation-modes";
import type { VideoGenerationOptions } from "@/lib/video-options";
import type { VideoEngine, VideoGenerationKind } from "@/lib/video-gen";
import {
  Activity,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Share2,
  Plus,
  FolderOpen,
  Film,
  Wand2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

const nodeTypes = {
  asset: AssetNodeComponent,
  panel: PanelNodeComponent,
  style: StyleNodeComponent,
  video: VideoNodeComponent,
};

const edgeTypes = {
  custom: CustomEdge,
};

interface Plan4CanvasProps {
  analysisResult?: AnalyzeAssetsResponse | null;
  storyboardResult?: GenerateStoryboardResponse | null;
  plan4Result?: Plan4DirectorOutlineResponse | null;
  assetImageUrls?: Record<string, string>;
  assetReferenceImages?: Record<string, string>;
  panelImageUrls?: Record<string, string>;
  initialCanvas?: Plan4CanvasState | null;
  onCanvasChange?: (canvas: Plan4CanvasState) => void;
  onGenerate?: (
    nodeId: string,
    prompt: string,
    referenceImages?: string[],
    style?: string,
    taskType?: ImageTaskType,
    assetType?: ImageAssetType,
    referenceMetas?: ImageReferenceMeta[]
  ) => Promise<string | undefined>;
  onClearPanelImage?: (panelId: string) => void;
  onClearAssetImage?: (assetName: string | string[]) => void;
  /** 资产参考图持久化回调（画布节点上传参考图时同步存 IndexedDB，防刷新丢失） */
  onAssetReferenceImageChange?: (assetName: string, image: string | null) => void;
  /** 分镜参考图持久化回调 */
  onPanelReferenceImageChange?: (panelId: string, image: string | null) => void;
  /** 分镜参考图（IndexedDB 持久化，刷新恢复用） */
  panelReferenceImages?: Record<string, string>;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textBaseUrl?: string;
  textApiKey?: string;
  videoBaseUrl?: string;
  videoApiKey?: string;
  videoModel?: string;
  /** 多引擎 API Key */
  videoApiKeys?: Record<string, string>;
  /** TTS 音频共享（base64 格式） */
  voiceAudioUrls?: Record<string, string>;
  /** 语音生成完成回调 */
  onVoiceGenerated?: (panelId: string, audioUrl: string) => void;
}

function CanvasInner({
  analysisResult,
  storyboardResult,
  plan4Result,
  assetImageUrls,
  assetReferenceImages,
  panelImageUrls,
  initialCanvas,
  onCanvasChange,
  onGenerate,
  onClearPanelImage,
  onClearAssetImage,
  onAssetReferenceImageChange,
  onPanelReferenceImageChange,
  panelReferenceImages = {},
  textProvider = "gemini",
  textModel = "gemini-2.5-pro",
  textBaseUrl,
  textApiKey,
  videoBaseUrl,
  videoApiKey,
  videoModel,
  videoApiKeys = {},
  voiceAudioUrls = {},
  onVoiceGenerated,
}: Plan4CanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node<Record<string, unknown>>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantResult, setAssistantResult] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const canvasSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSyncedCanvasOnceRef = useRef(false);

  // 包装 onNodesChange，当节点位置变化时发送事件通知弹窗关闭
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // 检测是否有节点位置变化（拖动节点）
    const hasPositionChange = changes.some((c) => c.type === "position" && c.dragging);
    if (hasPositionChange) {
      window.dispatchEvent(new CustomEvent("canvas-nodes-moving"));
    }
    onNodesChangeInternal(changes);
  }, [onNodesChangeInternal]);
  const [batchProgress, setBatchProgress] = useState("");
  const [contextMenu, setContextMenu] = useState({
    x: 0,
    y: 0,
    flowX: 0,
    flowY: 0,
    visible: false,
  });
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();

  const rightMouseDragStart = useRef<{ x: number; y: number; viewportX: number; viewportY: number } | null>(null);
  // 用于区分右键点击和拖动
  const rightMouseStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasRightMouseMoved = useRef(false);
  // 用于 UI 显示的 state（减少重渲染频率）
  const [isRightMouseDragging, setIsRightMouseDragging] = useState(false);

  // 日志面板
  const [logsOpen, setLogsOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  interface LogEntry {
    id: string;
    timestamp: number;
    provider: string;
    model: string;
    baseUrl: string;
    prompt: string;
    status: "pending" | "success" | "error";
    durationMs: number;
    result?: string;
    error?: string;
  }
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const mergeLogs = (prev: LogEntry[], incoming: LogEntry[]) => {
      const map = new Map(prev.map((log) => [log.id, log]));
      for (const log of incoming) {
        if (log.id.startsWith("job-") || log.prompt.startsWith("[异步任务已提交]")) {
          continue;
        }
        map.set(log.id, log);
      }
      return [...map.values()]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    };

    const connect = () => {
      if (es) {
        try { es.close(); } catch { /* ignore */ }
      }
      es = new EventSource("/api/logs/stream");

      es.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data) as LogEntry;
          setLogs((prev) => mergeLogs(prev, [entry]));
        } catch {
          // ignore malformed
        }
      };

      es.onerror = () => {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          console.warn("[Plan4Canvas] SSE disconnected, reconnecting...");
          connect();
        }, 2000);
      };

      es.onopen = () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
      };
    };

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (es) {
        try { es.close(); } catch { /* ignore */ }
      }
    };
  }, []);

  useEffect(() => {
    if (!logsOpen) return;

    const mergeLogs = (prev: LogEntry[], incoming: LogEntry[]) => {
      const map = new Map(prev.map((log) => [log.id, log]));
      for (const log of incoming) {
        if (log.id.startsWith("job-") || log.prompt.startsWith("[异步任务已提交]")) {
          continue;
        }
        map.set(log.id, log);
      }
      return [...map.values()]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    };

    const fetchSnapshot = async () => {
      try {
        const res = await fetch("/api/logs/stream?snapshot=1", {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          logs?: LogEntry[];
        };
        if (Array.isArray(data.logs)) {
          setLogs((prev) => mergeLogs(prev, data.logs!));
        }
      } catch {
        // 轮询只是兜底，失败时等待下一次即可
      }
    };

    fetchSnapshot();
    const snapshotTimer = setInterval(fetchSnapshot, 3000);
    return () => clearInterval(snapshotTimer);
  }, [logsOpen]);

  useEffect(() => {
    if (logsScrollRef.current && logsOpen) {
      logsScrollRef.current.scrollTop = 0;
    }
  }, [logs, logsOpen]);

  const formatLogTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  const pendingCount = logs.filter((l) => l.status === "pending").length;
  const assetCount = nodes.filter((n) => n.type === "asset").length;
  const panelCount = nodes.filter((n) => n.type === "panel").length;
  const doneCount = nodes.filter((n) => {
    const data = n.data as Record<string, unknown>;
    return data.generateStatus === "done" || data.imageUrl;
  }).length;

  // Dialog states
  const [importOpen, setImportOpen] = useState(false);
  const [importItems, setImportItems] = useState<{ id: string; name: string; description?: string; typeLabel: string; imageUrl?: string }[]>([]);
  const [importTitle, setImportTitle] = useState("导入");
  const [importMode, setImportMode] = useState<"asset" | "panel">("asset");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: "", message: "", onConfirm: () => {} });
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [pendingPanelPosition, setPendingPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const _nextPanelIdRef = useRef(1);

  // 详情面板
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);

  // 图片编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogNodeId, setEditDialogNodeId] = useState<string | null>(null);

  // 变体生成对话框
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantDialogNodeId, setVariantDialogNodeId] = useState<string | null>(null);

  // 生图模式面板
  const [generationModeOpen, setGenerationModeOpen] = useState(false);
  const [generationModeNodeId, setGenerationModeNodeId] = useState<string | null>(null);

  // 风格库
  const [styleLibraryOpen, setStyleLibraryOpen] = useState(false);

  // 可复用的轮询函数：轮询视频任务状态
  const pollVideoJob = useCallback(
    async (nodeId: string, jobId: string) => {
      const startedAt = Date.now();
      // 21 分钟 > 服务端 20 分钟兜底，让客户端能收到服务端的终态错误而不是自己先放弃
      const deadline = startedAt + 21 * 60_000;
      let consecutiveFailures = 0;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10_000)); // 10 秒轮询一次（减少请求量）

        let jobRes: Response;
        try {
          jobRes = await fetch(
            `/api/generate-video?jobId=${encodeURIComponent(jobId)}`
          );
        } catch {
          // 网络抖动不立刻放弃：dev 热更新/代理抖动可能造成单次失败，连续多次才判定中断
          consecutiveFailures += 1;
          if (consecutiveFailures >= 5) {
            throw new Error("连续多次查询视频任务失败，请检查网络后重试");
          }
          continue;
        }
        const job = (await jobRes.json().catch(() => ({}))) as {
          success?: boolean;
          status?: string;
          videoUrl?: string;
          previewUrl?: string;
          promptExportUrl?: string;
          error?: string;
        };

        // 任务不存在（可能服务重启）
        if (jobRes.status === 404) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      isGenerating: false,
                      generateStatus: "idle",
                      jobId: undefined,
                    },
                  }
                : n
            )
          );
          showToast("warning", "任务已中断，服务可能已重启，请重新生成");
          return;
        }

        if (!jobRes.ok) {
          // 非 404 的失败（5xx/网关抖动）给一定的容忍次数，避免长任务被单次抖动打死
          consecutiveFailures += 1;
          if (consecutiveFailures >= 5) {
            throw new Error(job.error ?? "连续多次查询视频任务失败");
          }
          continue;
        }
        consecutiveFailures = 0;

        // 任务成功
        if (job.status === "success" && (job.videoUrl || job.promptExportUrl)) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      isGenerating: false,
                      generateStatus: "done",
                      videoUrl: job.videoUrl,
                      previewUrl: job.previewUrl || job.videoUrl,
                      jobId: undefined,
                    },
                  }
                : n
            )
          );
          showToast("success", "视频生成成功");
          return;
        }

        // 任务失败
        if (job.status === "error") {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      isGenerating: false,
                      generateStatus: "error",
                      error: job.error ?? "视频任务失败",
                      jobId: undefined,
                    },
                  }
                : n
            )
          );
          showToast("error", job.error ?? "视频任务失败");
          return;
        }
      }

      // 超时
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  isGenerating: false,
                  generateStatus: "error",
                  error: "视频任务超时",
                  jobId: undefined,
                },
              }
            : n
        )
      );
      showToast("error", "视频任务超时，请稍后重试");
    },
    [setNodes]
  );

  // 初始化：仅挂载时恢复一次，避免清空后被重复恢复
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && initialCanvas?.nodes?.length) {
      initializedRef.current = true;
      setNodes(initialCanvas.nodes as unknown as Node[]);
      // 兼容旧数据：给没有 sourceHandle/targetHandle 的边补上默认值，使其变为横向连线；去重 id
      const seen = new Set<string>();
      const patchedEdges = (initialCanvas.edges as unknown as Edge[])
        .map((e) => ({
          ...e,
          sourceHandle: e.sourceHandle ?? "right",
          targetHandle: e.targetHandle ?? "left",
        }))
        .filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      setEdges(patchedEdges);

      // 恢复轮询：扫描 generateStatus === "generating" && jobId 的节点
      setTimeout(() => {
        const currentNodes = initialCanvas.nodes as unknown as Node[];
        for (const node of currentNodes) {
          const data = node.data as Record<string, unknown>;
          if (data.generateStatus === "generating" && data.jobId) {
            console.log(`[VideoNode] 恢复轮询: ${node.id}, jobId: ${data.jobId}`);
            pollVideoJob(node.id, data.jobId as string);
          }
        }
      }, 500); // 延迟 500ms 等待画布完全渲染
    }
  }, [initialCanvas, setNodes, setEdges, pollVideoJob]);

  // panelImageUrls 被整体清空（重新生成分镜/重分析剧本）时，同步清掉画布分镜节点的旧图，
  // 否则节点 data.imageUrl 里残留旧图，点击分镜仍显示旧图。
  // 只在"清空事件"（panelImageUrls 变空）时清，避免逐张填充时误清未入库节点的图
  useEffect(() => {
    if (Object.keys(panelImageUrls ?? {}).length !== 0) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === "panel" && (n.data as Record<string, unknown>).imageUrl) {
          return { ...n, data: { ...(n.data as Record<string, unknown>), imageUrl: undefined } };
        }
        return n;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelImageUrls]);

  // 变更时防抖向上同步。拖拽节点会产生大量 position 变更，立即持久化会让画布发黏。
  useEffect(() => {
    if (!hasSyncedCanvasOnceRef.current) {
      hasSyncedCanvasOnceRef.current = true;
      return;
    }

    if (canvasSyncTimerRef.current) {
      clearTimeout(canvasSyncTimerRef.current);
    }
    canvasSyncTimerRef.current = setTimeout(() => {
      const strippedNodes = nodes.map((n) => {
        const restData = { ...(n.data as Record<string, unknown>) };
        delete restData.imageUrl;
        delete restData.referenceImage;
        return { ...n, data: restData };
      });
      onCanvasChange?.({
        nodes: strippedNodes as unknown as Plan4CanvasState["nodes"],
        edges: edges as unknown as Plan4CanvasState["edges"],
      });
    }, 450);

    return () => {
      if (canvasSyncTimerRef.current) {
        clearTimeout(canvasSyncTimerRef.current);
      }
    };
  }, [nodes, edges, onCanvasChange]);

  // 画布引用的视频 taskId 上报到服务端引用清单：清理旧视频时放行仍被引用的文件。
  // 服务端看不到画布数据（在 localStorage/内存），不主动上报的话"7 天/最近 20 个"
  // 清理规则会把画布上还挂着的视频删成 404。
  const videoRefsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (videoRefsTimerRef.current) clearTimeout(videoRefsTimerRef.current);
    videoRefsTimerRef.current = setTimeout(() => {
      const taskIds = new Set<string>();
      for (const n of nodes) {
        if (n.type !== "video") continue;
        const d = n.data as Record<string, unknown>;
        for (const url of [d.videoUrl, d.previewUrl]) {
          const id = extractVideoTaskId(url as string | undefined);
          if (id) taskIds.add(id);
        }
      }
      if (taskIds.size === 0) return;
      // 上报失败只影响清理豁免，不阻断画布
      void fetch("/api/media/video-refs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...taskIds] }),
      }).catch(() => {});
    }, 1200);
    return () => {
      if (videoRefsTimerRef.current) clearTimeout(videoRefsTimerRef.current);
    };
  }, [nodes]);

  const getEdgeSemantic = useCallback((source?: string | null, target?: string | null) => {
    const srcIsPanel = source?.startsWith("panel-");
    const tgtIsPanel = target?.startsWith("panel-");
    const _srcIsStyle = source?.startsWith("style-");
    const tgtIsStyle = target?.startsWith("style-");
    if (tgtIsStyle) return "styled_by";
    if (srcIsPanel && tgtIsPanel) return "continues";
    if (srcIsPanel && !tgtIsPanel) return "uses";
    return "references";
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      const semantic = getEdgeSemantic(connection.source, connection.target);
      const isContinues = semantic === "continues";
      const isUses = semantic === "uses";
      const isStyledBy = semantic === "styled_by";
      const isAnimated = isContinues || isUses;
      const color = isContinues ? "rgba(245, 158, 11, 0.12)" : isUses ? "rgba(168, 85, 247, 0.12)" : isStyledBy ? "rgba(236, 72, 153, 0.12)" : "rgba(99, 102, 241, 0.12)";
      const labelText = isContinues ? "续" : isUses ? "使用" : isStyledBy ? "风格" : "参考";
      const newEdge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? "right",
        targetHandle: connection.targetHandle ?? "left",
        type: "custom",
        animated: isAnimated,
        data: { semanticType: semantic },
        style: { stroke: color, strokeWidth: 1.5 },
        label: labelText,
        labelStyle: { fill: "#a1a1aa", fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: "rgba(0,0,0,0.7)", rx: 4 },
        labelBgPadding: [4, 4] as [number, number],
        labelBgBorderRadius: 4,
      };
      setEdges((eds) => {
        // 避免相同 source-target 的重复边
        const exists = eds.some((e) => e.source === connection.source && e.target === connection.target);
        if (exists) return eds;
        return addEdge(newEdge as Edge, eds);
      });
    },
    [setEdges, getEdgeSemantic]
  );

  // 计算当前视口中心在 flow 坐标系中的位置
  const getViewportCenter = useCallback(() => {
    const wrapper = document.querySelector(".react-flow");
    const rect = wrapper?.getBoundingClientRect();
    const centerScreenX = (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2;
    const centerScreenY = (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2;
    return screenToFlowPosition({ x: centerScreenX, y: centerScreenY });
  }, [screenToFlowPosition]);

  const handleAddAsset = useCallback(
    (x: number, y: number) => {
      const id = `asset-${Date.now()}`;
      // 默认名去重编号（"新资产"、"新资产 2"、…），在 updater 内基于当前节点算，
      // 避免 data.name 重复导致的历史按名存取串图问题
      setNodes((nds) => {
        const names = new Set(
          nds.map((n) => (n.data as Record<string, unknown>).name as string)
        );
        let name = "新资产";
        for (let i = 2; names.has(name); i++) name = `新资产 ${i}`;
        const newNode = {
          id,
          type: "asset",
          position: { x, y },
          data: {
            name,
            description: "",
            assetType: "custom",
          },
        };
        return [...nds, newNode as Node];
      });
      setContextMenu((prev) => ({ ...prev, visible: false }));
      showToast("success", "已添加资产节点");
    },
    [setNodes]
  );

  const handleAddPanel = useCallback(
    (x: number, y: number) => {
      setPendingPanelPosition({ x, y });
      setContextMenu((prev) => ({ ...prev, visible: false }));
      setCreatePanelOpen(true);
    },
    []
  );

  const handleAddStyle = useCallback(
    (x: number, y: number) => {
      const id = `style-${Date.now()}`;
      const newNode = {
        id,
        type: "style",
        position: { x, y },
        data: {
          name: STYLE_CONFIGS[DEFAULT_STYLE].label,
          styleValue: DEFAULT_STYLE,
        },
      };
      setNodes((nds) => [...nds, newNode as Node]);
      setContextMenu((prev) => ({ ...prev, visible: false }));
      showToast("success", "已添加风格节点");
    },
    [setNodes]
  );

  // 添加视频节点
  const handleAddVideo = useCallback(
    (x: number, y: number) => {
      const id = `video-${Date.now()}`;
      const newNode = {
        id,
        type: "video",
        position: { x, y },
        data: {
          prompt: "",
          kind: "text-to-video",
          engine: "autodl",
          duration: 5,
          resolution: "480p竖",
          generateStatus: "idle",
          voiceAudioUrls,
          videoApiKeys,
        },
      };
      setNodes((nds) => [...nds, newNode as Node]);
      setContextMenu((prev) => ({ ...prev, visible: false }));
      showToast("success", "已添加视频节点");
    },
    [setNodes, voiceAudioUrls, videoApiKeys]
  );

  const handleConfirmCreatePanel = useCallback(
    (data: {
      panelId: number;
      storyBeat: string;
      englishImagePrompt: string;
      chineseDirectorNotes: string;
    }) => {
      const id = `panel-${data.panelId}`;
      const pos = pendingPanelPosition ?? { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
      const newNode = {
        id,
        type: "panel",
        position: pos,
        data: {
          panelId: data.panelId,
          storyBeat: data.storyBeat,
          englishImagePrompt: data.englishImagePrompt,
          chineseDirectorNotes: data.chineseDirectorNotes,
        },
      };
      setNodes((nds) => {
        const existing = nds.find((n) => n.id === id);
        if (existing) {
          showToast("warning", `分镜 #${data.panelId} 已存在`);
          return nds;
        }
        return [...nds, newNode as Node];
      });
      setCreatePanelOpen(false);
      setPendingPanelPosition(null);
      showToast("success", `已创建分镜 #${data.panelId}`);
    },
    [pendingPanelPosition, setNodes]
  );

  const typeLabelMap: Record<string, string> = {
    character: "角色",
    creature: "生物",
    scene: "场景",
    prop: "道具",
    cockpit: "座舱",
    custom: "自定义",
  };

  const handleImportAssets = useCallback(() => {
    if (!analysisResult) {
      showToast("warning", "暂无分析结果可供导入");
      return;
    }
    const allAssets = [
      ...(analysisResult.characters ?? []).map((c) => ({
        id: `asset-${c.name}`,
        name: c.name,
        description: c.description,
        typeLabel: typeLabelMap["character"] ?? "角色",
        imageUrl: assetImageUrls?.[c.name],
      })),
      ...(analysisResult.creatures ?? []).map((c) => ({
        id: `asset-${c.name}`,
        name: c.name,
        description: c.description,
        typeLabel: typeLabelMap["creature"] ?? "生物",
        imageUrl: assetImageUrls?.[c.name],
      })),
      ...(analysisResult.scenes ?? []).map((s) => ({
        id: `asset-${s.name}`,
        name: s.name,
        description: s.description,
        typeLabel: typeLabelMap["scene"] ?? "场景",
        imageUrl: assetImageUrls?.[s.name],
      })),
      ...(analysisResult.props ?? []).map((p) => ({
        id: `asset-${p.name}`,
        name: p.name,
        description: p.description,
        typeLabel: typeLabelMap["prop"] ?? "道具",
        imageUrl: assetImageUrls?.[p.name],
      })),
      ...(analysisResult.cockpits ?? []).map((c) => ({
        id: `asset-${c.name}`,
        name: c.name,
        description: c.description,
        typeLabel: typeLabelMap["cockpit"] ?? "座舱",
        imageUrl: assetImageUrls?.[c.name],
      })),
    ];
    setImportTitle("导入资产");
    setImportItems(allAssets);
    setImportMode("asset");
    setImportOpen(true);
  }, [analysisResult, assetImageUrls]);

  const handleConfirmImportAssets = useCallback(
    (selectedIds: string[]) => {
      if (!analysisResult) return;
      const allAssets = [
        ...(analysisResult.characters ?? []).map((c) => ({ ...c, assetType: "character" as const })),
        ...(analysisResult.creatures ?? []).map((c) => ({ ...c, assetType: "creature" as const })),
        ...(analysisResult.scenes ?? []).map((s) => ({ ...s, assetType: "scene" as const })),
        ...(analysisResult.props ?? []).map((p) => ({ ...p, assetType: "prop" as const })),
        ...(analysisResult.cockpits ?? []).map((c) => ({ ...c, assetType: "cockpit" as const })),
      ];

      const startX = 100;
      const startY = 100;
      const gapX = 260;
      const gapY = 60;
      const perRow = 5;

      const newNodes = selectedIds
        .map((id) => {
          const name = id.replace("asset-", "");
          const asset = allAssets.find((a) => a.name === name);
          if (!asset) return null;
          const idx = allAssets.findIndex((a) => a.name === name);
          return {
            id,
            type: "asset",
            position: {
              x: startX + (idx % perRow) * gapX,
              y: startY + Math.floor(idx / perRow) * gapY,
            },
            data: {
              name: asset.name,
              description: asset.description,
              assetType: asset.assetType,
            },
          };
        })
        .filter(Boolean) as Node[];

      // 清除已存在资产的旧图片并替换节点
      const existingAssetIds = new Set(nodes.map((n) => n.id));
      for (const id of selectedIds) {
        if (existingAssetIds.has(id)) {
          onClearAssetImage?.(assetImageKeysForNode(id));
        }
      }

      setNodes((prev) => {
        const withoutOld = prev.filter((n) => !selectedIds.includes(n.id));
        return [...withoutOld, ...newNodes];
      });
      setImportOpen(false);
      showToast("success", `已导入 ${newNodes.length} 个资产`);
    },
    [analysisResult, setNodes, nodes, onClearAssetImage]
  );

  const handleImportPanels = useCallback(() => {
    const panels =
      plan4Result?.panels ??
      storyboardResult?.panels?.map((p) => ({
        panelIndex: p.panelId,
        storyBeat: p.chineseDirectorNotes ?? `分镜 #${p.panelId}`,
        englishImagePrompt: p.englishImagePrompt ?? "",
        chineseDirectorNotes: p.chineseDirectorNotes,
        generationStrategy: "single_t2i" as const,
        strategyRationale: "从分镜导入",
      })) ??
      [];

    if (panels.length === 0) {
      showToast("warning", "暂无分镜数据可供导入");
      return;
    }

    setImportTitle("导入分镜");
    setImportItems(
      panels.map((p) => ({
        id: `panel-${p.panelIndex}`,
        name: `#${p.panelIndex} ${p.storyBeat.slice(0, 30)}`,
        description: p.englishImagePrompt?.slice(0, 60),
        typeLabel: "分镜",
        imageUrl: panelImageUrls?.[`panel-${p.panelIndex}`],
      }))
    );
    setImportMode("panel");
    setImportOpen(true);
  }, [plan4Result, storyboardResult, panelImageUrls]);

  const handleConfirmImportPanels = useCallback(
    (selectedIds: string[]) => {
      const panels =
        plan4Result?.panels ??
        storyboardResult?.panels?.map((p) => ({
          panelIndex: p.panelId,
          storyBeat: p.chineseDirectorNotes ?? `分镜 #${p.panelId}`,
          englishImagePrompt: p.englishImagePrompt ?? "",
          chineseDirectorNotes: p.chineseDirectorNotes,
        })) ??
        [];

      const startX = 100;
      const startY = 100;
      const gapX = 320;
      const gapY = 60;
      const perRow = 5;

      const newNodes = selectedIds
        .map((id) => {
          const panelIndex = parseInt(id.replace("panel-", ""), 10);
          const panel = panels.find((p) => p.panelIndex === panelIndex);
          if (!panel) return null;
          const idx = panels.findIndex((p) => p.panelIndex === panelIndex);
          return {
            id,
            type: "panel",
            position: {
              x: startX + (idx % perRow) * gapX,
              y: startY + Math.floor(idx / perRow) * gapY,
            },
            data: {
              panelId: panel.panelIndex,
              storyBeat: panel.storyBeat,
              englishImagePrompt: panel.englishImagePrompt,
              chineseDirectorNotes: panel.chineseDirectorNotes,
            },
          };
        })
        .filter(Boolean) as Node[];

      // 清除已存在 panel 的旧图片并替换节点
      const existingIds = new Set(nodes.map((n) => n.id));
      for (const id of selectedIds) {
        if (existingIds.has(id)) {
          onClearPanelImage?.(id);
        }
      }

      setNodes((prev) => {
        const withoutOld = prev.filter((n) => !selectedIds.includes(n.id));
        return [...withoutOld, ...newNodes];
      });
      setImportOpen(false);
      showToast("success", `已导入 ${newNodes.length} 个分镜`);
    },
    [plan4Result, storyboardResult, setNodes, nodes, onClearPanelImage]
  );

  const handleExport = useCallback(() => {
    const canvas: Plan4CanvasState = {
      nodes: nodes as unknown as Plan4CanvasState["nodes"],
      edges: edges as unknown as Plan4CanvasState["edges"],
    };
    const blob = new Blob([JSON.stringify(canvas, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan4-canvas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "画布已导出为 JSON");
  }, [nodes, edges]);

  const handleClear = useCallback(() => {
    setConfirmConfig({
      title: "清空画布",
      message: "确定清空画布？所有节点和连线将丢失，此操作不可撤销。",
      onConfirm: () => {
        setNodes([]);
        setEdges([]);
        setConfirmOpen(false);
        showToast("info", "画布已清空");
      },
    });
    setConfirmOpen(true);
  }, [setNodes, setEdges]);

  // 获取节点连接的风格（节点 -> style 的出边）
  const getNodeStyle = useCallback((nodeId: string) => {
    const styleEdge = edges.find((e) => e.source === nodeId && (e.data as any)?.semanticType === "styled_by");
    if (!styleEdge) return null;
    const styleNode = nodes.find((n) => n.id === styleEdge.target);
    if (!styleNode || styleNode.type !== "style") return null;
    const sd = styleNode.data as Record<string, unknown>;
    return {
      value: (sd.styleValue as string) || DEFAULT_STYLE,
      color: STYLE_CONFIGS[(sd.styleValue as string) || DEFAULT_STYLE]?.color,
    };
  }, [edges, nodes]);

  // 获取所有锁定的角色资产
  const getLockedCharacters = useCallback(() => {
    const locked: { nodeId: string; name: string; imageUrl: string; consistencyPrompt?: string }[] = [];
    nodes.forEach((n) => {
      if (n.type !== "asset") return;
      const d = n.data as Record<string, unknown>;
      if (d.assetType !== "character") return;
      if (!d.consistencyLock) return;
      // 图按节点 id 索引（slice(6) 兼容导入资产节点 id 后半=资产名），不按 data.name 直查——
      // 名字不唯一（多个"新资产"），按名字读会让同名节点互相显示对方的图
      const img =
        assetImageUrls?.[n.id] ||
        assetImageUrls?.[n.id.slice(6)] ||
        (d.imageUrl as string) ||
        assetReferenceImages?.[n.id] ||
        assetReferenceImages?.[n.id.slice(6)] ||
        (d.referenceImage as string);
      if (img) {
        locked.push({
          nodeId: n.id,
          name: (d.name as string) || n.id,
          imageUrl: img as string,
          consistencyPrompt: (d.consistencyPrompt as string) || undefined,
        });
      }
    });
    return locked;
  }, [nodes, assetImageUrls, assetReferenceImages]);

  const handleNodeGenerate = useCallback(
    async (nodeId: string, prompt: string, refImages?: string[]): Promise<string | undefined> => {
      if (!onGenerate) return undefined;
      const targetNode = nodes.find((n) => n.id === nodeId);
      const { taskType, assetType: targetAssetType } = resolveNodeTaskType(
        nodeId,
        targetNode
      );

      const connectedRefItems = collectConnectedReferenceItems({
        nodeId,
        edges,
        nodes,
        assetImageUrls,
        assetReferenceImages,
        panelImageUrls,
      });
      const isComicSequence = hasContinuesInput(nodeId, edges, nodes);

      let enhancedPrompt = prompt;

      // 连环画模式：自动追加连续性提示词模板
      if (isComicSequence) {
        const comicTemplate = `This panel is the next frame in a sequential comic/manga. It must maintain strict visual continuity with the previous frame(s): same characters, consistent poses and expressions, coherent lighting, and matching art style. The composition should feel like a natural progression of the story.`;
        enhancedPrompt = `${comicTemplate}\n\n${enhancedPrompt}`;
      }

      // 角色一致性：强制加入锁定角色的已生成图片到最前面
      const lockedCharacters = getLockedCharacters();
      const allRefImages: string[] = [];
      const referenceMetas: ImageReferenceMeta[] = [];
      for (const char of lockedCharacters) {
        addReferenceImage(allRefImages, referenceMetas, char.imageUrl, {
          name: char.name,
          type: "character",
        });
      }
      // 如果锁定角色有 consistencyPrompt，注入到 prompt 最前面
      if (lockedCharacters.length > 0) {
        const lockPrompts = lockedCharacters
          .filter((c) => c.consistencyPrompt)
          .map((c) => `[Character consistency: ${c.consistencyPrompt}]`)
          .join("\n");
        if (lockPrompts) {
          enhancedPrompt = `${lockPrompts}\n\n${enhancedPrompt}`;
        }
      }

      for (const item of connectedRefItems) {
        addReferenceImage(allRefImages, referenceMetas, item.url, {
          name: item.name,
          type: normalizeReferenceType(item.type),
        });
      }
      if (refImages?.length) {
        for (const img of refImages) {
          addReferenceImage(allRefImages, referenceMetas, img, {
            name: "manual reference",
            type: "reference",
          });
        }
      }

      // 获取风格
      const style = getNodeStyle(nodeId);

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isGenerating: true, generateStatus: "generating", generateProgress: undefined } }
            : n
        )
      );
      try {
        const url = await onGenerate(
          nodeId,
          enhancedPrompt,
          allRefImages.length > 0 ? allRefImages : undefined,
          style?.value,
          taskType,
          targetAssetType,
          referenceMetas.length > 0 ? referenceMetas : undefined
        );
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isGenerating: false, generateStatus: "done", generateProgress: undefined, imageUrl: url ?? n.data.imageUrl } }
              : n
          )
        );
        // 自动下载到浏览器默认下载目录
        if (url) {
          try {
            const a = document.createElement("a");
            if (url.startsWith("data:")) {
              a.href = url;
            } else {
              const res = await fetch(url);
              const blob = await res.blob();
              a.href = URL.createObjectURL(blob);
              setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
            }
            const name = nodeId.startsWith("panel-") ? `panel-${nodeId.slice(6)}` : (nodes.find((n) => n.id === nodeId)?.data as any)?.name || nodeId;
            a.download = `${name}.png`;
            a.click();
          } catch {
            // 下载失败不阻断主流程
          }
        }
        showToast("success", `${nodeId.startsWith("panel-") ? "分镜" : "资产"}生图成功`);
        return url;
      } catch (err) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isGenerating: false, generateStatus: "error", generateProgress: undefined } }
              : n
          )
        );
        const msg = err instanceof Error ? err.message : "生图失败";
        showToast("error", msg);
        return undefined;
      }
    },
    [onGenerate, setNodes, edges, nodes, assetImageUrls, assetReferenceImages, panelImageUrls, getLockedCharacters, getNodeStyle]
  );

  const handleNodeVideoGenerate = useCallback(
    async (
      nodeId: string,
      mode: Extract<GenerationMode, "seedance-text-to-video" | "seedance-image-to-video" | "zzdh-text-to-video" | "zzdh-first-last-frame" | "zzdh-multi-reference" | "zzdh-multi-image-audio" | "zzdh-lip-sync">,
      prompt: string,
      referenceImages?: string[],
      options?: VideoGenerationOptions
    ): Promise<string | undefined> => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      const panelId = (targetNode?.data as Record<string, unknown> | undefined)?.panelId as number | undefined;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  isGenerating: true,
                  generateStatus: "generating",
                  generateProgress: undefined,
                  videoUrl: undefined,
                  promptExportUrl: undefined,
                  generationOutputType: undefined,
                },
              }
            : n
        )
      );

      try {
        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            prompt,
            panelId,
            referenceImages,
            referenceAudios: options?.referenceAudios,
            apiKey: videoApiKey?.trim() || undefined,
            baseUrl: videoBaseUrl?.trim() || undefined,
            model: videoModel?.trim() || undefined,
            aspectRatio:
              options?.aspectRatio ||
              ((targetNode?.data as Record<string, unknown> | undefined)?.aspectRatio as string | undefined) ||
              "16:9",
            duration: options?.duration ?? 5,
            quality: options?.quality ?? "720p",
            generateAudio: options?.generateAudio ?? true,
            watermark: options?.watermark ?? false,
            async: true,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          jobId?: string;
          status?: "pending" | "success" | "error";
          videoUrl?: string;
          promptExportUrl?: string;
          outputType?: "video" | "prompt-export";
          error?: string;
          errorKind?: string;
        };

        // 保存 jobId 到节点 data，以便刷新后恢复轮询
        if (data.jobId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, jobId: data.jobId } }
                : n
            )
          );
        }

        const videoUrl = data.videoUrl;
        const promptExportUrl = data.promptExportUrl;
        const outputType = data.outputType;

        // 如果没有直接返回 videoUrl/promptExportUrl，使用 pollVideoJob 轮询
        if (res.ok && data.jobId && !videoUrl && !promptExportUrl) {
          await pollVideoJob(nodeId, data.jobId);
          // pollVideoJob 成功后会直接设置节点的 videoUrl，这里直接返回即可
          showToast("success", "视频生成成功");
          return data.videoUrl;
        }

        if (!res.ok || !data.success || (!videoUrl && !promptExportUrl)) {
          throw new Error(data.error ?? "视频任务失败");
        }

        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isGenerating: false,
                    generateStatus: "done",
                    generateProgress: undefined,
                    videoUrl,
                    promptExportUrl,
                    generationOutputType: outputType ?? (videoUrl ? "video" : "prompt-export"),
                  },
                }
              : n
          )
        );

        showToast(
          "success",
          videoUrl ? "视频生成成功" : "未配置视频 API Key，已导出 Seedance 提示词"
        );
        return videoUrl ?? promptExportUrl;
      } catch (err) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isGenerating: false,
                    generateStatus: "error",
                    generateProgress: undefined,
                  },
                }
              : n
          )
        );
        const msg = err instanceof Error ? err.message : "视频任务失败";
        showToast("error", msg);
        return undefined;
      }
    },
    [nodes, setNodes, videoApiKey, videoBaseUrl, videoModel, pollVideoJob]
  );

  // 处理视频导入
  const handleImportVideo = useCallback(
    (nodeId: string, videoUrl: string, previewUrl: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  generateStatus: "done",
                  videoUrl,
                  previewUrl,
                  error: undefined,
                },
              }
            : n
        )
      );
      showToast("success", "视频导入成功");
    },
    [setNodes, showToast]
  );

  // 重新抓取视频 URL（从 jobId 重新查询）
  const handleRefetchVideoUrl = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeData = node.data as Record<string, unknown>;
      const jobId = nodeData.jobId as string | undefined;
      let currentVideoUrl = nodeData.videoUrl as string | undefined;

      // 如果有 jobId，尝试重新轮询
      if (jobId) {
        showToast("info", "正在重新查询视频状态...");
        try {
          await pollVideoJob(nodeId, jobId);
          showToast("success", "视频 URL 已更新");
        } catch (err) {
          console.error("[VideoNode] 重新查询失败:", err);
          showToast("error", "重新查询失败，请重试");
        }
        return;
      }

      // 修复旧格式的 URL（/api/media/output/videos/xxx.mp4 → /api/media/videos/xxx.mp4）
      if (currentVideoUrl && currentVideoUrl.includes("/output/")) {
        const fixedUrl = currentVideoUrl.replace("/output/", "/");
        console.log(`[VideoNode] 修复 URL: ${currentVideoUrl} → ${fixedUrl}`);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    videoUrl: fixedUrl,
                    previewUrl: (nodeData.previewUrl as string)?.includes("/output/")
                      ? (nodeData.previewUrl as string).replace("/output/", "/")
                      : nodeData.previewUrl,
                  },
                }
              : n
          )
        );
        currentVideoUrl = fixedUrl;
        showToast("success", "已修复视频 URL 格式");
        return;
      }

      // 如果没有 jobId 但有 videoUrl，尝试验证当前 URL 是否可访问
      if (currentVideoUrl) {
        showToast("info", "正在验证视频 URL...");
        try {
          const res = await fetch(currentVideoUrl, { method: "HEAD" });
          if (res.ok) {
            showToast("success", "视频 URL 有效");
          } else {
            showToast("error", `视频 URL 无效 (${res.status})，请重新生成`);
          }
        } catch {
          showToast("error", "视频 URL 无法访问，请重新生成");
        }
        return;
      }

      showToast("warning", "没有可查询的视频信息，请重新生成");
    },
    [nodes, pollVideoJob, showToast]
  );

  // 处理视频节点的生成请求（支持 engine + kind）
  const handleVideoNodeGenerate = useCallback(
    async (
      nodeId: string,
      engine: VideoEngine,
      kind: VideoGenerationKind,
      prompt: string,
      connectedPanelIds?: string[],
      audioBase64?: string,
      options?: { duration?: number; resolution?: string }
    ) => {
      console.log("[VideoNode] 开始生成:", { nodeId, engine, kind, prompt, options, connectedPanelIds });
      // 收集参考图（从连接的分镜节点获取 imageUrl）
      const referenceImages: string[] = [];

      if (connectedPanelIds && connectedPanelIds.length > 0) {
        for (const panelId of connectedPanelIds) {
          const panelNode = nodes.find((n) => n.id === panelId);
          if (panelNode) {
            const nodeData = panelNode.data as Record<string, unknown>;
            // 检查 imageUrl 和 referenceImage 两个字段
            const imageUrl = (nodeData.imageUrl || nodeData.referenceImage) as string | undefined;
            console.log(`[VideoNode] 分镜节点 ${panelId} imageUrl:`, imageUrl?.substring(0, 100));
            if (imageUrl) {
              // 直接使用原始数据（base64 或 URL）
              // AutoDL API 会处理 base64 数据（stripDataUrlPrefix 会处理前缀）
              referenceImages.push(imageUrl);
              console.log(`[VideoNode] 添加参考图成功`);
            }
          }
        }
        console.log("[VideoNode] 收集到的参考图数量:", referenceImages.length);

        // 图生/多图/首尾帧模式需要至少一张图
        if (referenceImages.length === 0 && kind !== "text-to-video") {
          showToast("error", "请先生成分镜图");
          return;
        }
      }

      // 获取对应引擎的 API Key
      const apiKey = videoApiKeys[engine] || videoApiKey?.trim() || undefined;

      // 设置节点状态为生成中
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  generateStatus: "generating",
                  error: undefined,
                  kind,
                  engine,
                  duration: options?.duration,
                  resolution: options?.resolution,
                },
              }
            : n
        )
      );

      try {
        // 构建请求体
        const requestBody: Record<string, unknown> = {
          engine,
          kind,
          prompt,
          apiKey,
          duration: options?.duration || 5,
          quality: options?.resolution || (engine === "autodl" ? "480p竖" : "720p"),
          async: true,
        };

        // 添加参考图（如果有）
        if (referenceImages.length > 0) {
          requestBody.referenceImages = referenceImages;
        }

        // 添加音频（如果有，且是音频模式）
        if (audioBase64 && (kind === "multi-image-audio" || kind === "lip-sync")) {
          requestBody.referenceAudios = [audioBase64];
        }

        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          jobId?: string;
          videoUrl?: string;
          previewUrl?: string;
          error?: string;
        };

        // 保存 jobId 到节点 data，以便刷新后恢复轮询
        if (data.jobId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, jobId: data.jobId } }
                : n
            )
          );
        }

        const videoUrl = data.videoUrl;
        const previewUrl = data.previewUrl;

        // 如果没有直接返回 videoUrl，使用 pollVideoJob 轮询
        if (res.ok && data.jobId && !videoUrl) {
          await pollVideoJob(nodeId, data.jobId);
          // pollVideoJob 成功后会直接设置节点的 videoUrl，这里直接返回即可
          showToast("success", "视频生成成功");
          return data.videoUrl;
        }

        if (!res.ok || !data.success || !videoUrl) {
          throw new Error(data.error ?? "视频任务失败");
        }

        // 更新节点状态为成功
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isGenerating: false,
                    generateStatus: "done",
                    videoUrl,
                    previewUrl: previewUrl || videoUrl,
                  },
                }
              : n
          )
        );

        showToast("success", "视频生成成功");
      } catch (err) {
        // 更新节点状态为失败
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isGenerating: false,
                    generateStatus: "error",
                    error: err instanceof Error ? err.message : "视频任务失败",
                  },
                }
              : n
          )
        );
        const msg = err instanceof Error ? err.message : "视频任务失败";
        showToast("error", msg);
      }
    },
    [nodes, setNodes, videoApiKey, videoApiKeys]
  );

  // 监听 canvas-generate 事件（原底部创作栏派发；现底部栏已删，此监听保留备用）
  // 用 ref 保存最新值，监听器只挂载一次（避免 nodes 拖拽变化导致监听器频繁重挂载）
  const nodesForCommandRef = useRef(nodes);
  nodesForCommandRef.current = nodes;
  // 最新画布数据快照（节点/连线/外部图映射）：批量生成等多步异步流程在 await
  // 之间读 ref 而不是闭包，上游刚生成的图对下游立即可见
  const latestCanvasRef = useRef({ nodes, edges, assetImageUrls, assetReferenceImages, panelImageUrls });
  latestCanvasRef.current = { nodes, edges, assetImageUrls, assetReferenceImages, panelImageUrls };
  const handleNodeGenerateRef = useRef(handleNodeGenerate);
  handleNodeGenerateRef.current = handleNodeGenerate;
  const handleVideoNodeGenerateRef = useRef(handleVideoNodeGenerate);
  handleVideoNodeGenerateRef.current = handleVideoNodeGenerate;
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        prompt?: string;
        duration?: string;
        resolution?: string;
      } | undefined;
      const selected = nodesForCommandRef.current.filter((n) => n.selected);
      if (selected.length === 0) {
        showToast("info", "请先在画布选中一个节点（分镜/资产/视频）");
        return;
      }
      const node = selected[0];
      const d = node.data as Record<string, unknown>;
      // 提示词用节点自身的（卡片下方输入框）
      const prompt = (d.prompt as string | undefined)?.trim();
      if (!prompt) {
        showToast("info", "请先在选中节点的提示词框里输入内容");
        return;
      }
      if (node.type === "video") {
        void handleVideoNodeGenerateRef.current(
          node.id,
          (d.engine as "autodl" | "ark" | "zizidonghua") ?? "autodl",
          (d.kind as Parameters<typeof handleVideoNodeGenerate>[2]) ?? "text-to-video",
          prompt,
          undefined,
          undefined,
          {
            duration: Number((detail?.duration || "10s").replace("s", "")) || undefined,
            resolution: detail?.resolution || undefined,
          }
        );
      } else {
        void handleNodeGenerateRef.current(node.id, prompt);
      }
    };
    window.addEventListener("canvas-generate", handler);
    return () => window.removeEventListener("canvas-generate", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听卡片"资产库"按钮派发的事件 → 打开资产库抽屉
  useEffect(() => {
    const openLibrary = () => setAssetLibraryOpen(true);
    window.addEventListener("open-asset-library", openLibrary);
    return () => window.removeEventListener("open-asset-library", openLibrary);
  }, []);

  const handleBatchGenerate = useCallback(async () => {
    if (!onGenerate) return;
    const selectedNodes = nodes.filter((n) => n.selected);
    const targetNodes = selectedNodes.length > 0 ? selectedNodes : nodes;
    if (!targetNodes.length) return;

    setIsGenerating(true);
    try {
      // 拓扑排序：被 reference 的节点先生成
      const nodeIds = new Set(targetNodes.map((n) => n.id));
      const inDegree: Record<string, number> = {};
      targetNodes.forEach((n) => (inDegree[n.id] = 0));

      const isDependencyEdge = (e: Edge) => {
        const st = (e.data as any)?.semanticType;
        return st === "references" || st === "continues";
      };
      edges.forEach((e) => {
        if (nodeIds.has(e.source) && nodeIds.has(e.target) && isDependencyEdge(e)) {
          inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;
        }
      });

      const queue = targetNodes.filter((n) => !inDegree[n.id]).map((n) => n.id);
      const sorted: string[] = [];
      while (queue.length) {
        const id = queue.shift()!;
        sorted.push(id);
        edges.forEach((e) => {
          if (e.source === id && isDependencyEdge(e) && nodeIds.has(e.target)) {
            inDegree[e.target]--;
            if (inDegree[e.target] === 0) queue.push(e.target);
          }
        });
      }
      targetNodes.forEach((n) => {
        if (!sorted.includes(n.id)) sorted.push(n.id);
      });

      let successCount = 0;
      let errorCount = 0;
      const total = sorted.length;

      for (let i = 0; i < sorted.length; i++) {
        const nodeId = sorted[i];
        setBatchProgress(`生图 ${i + 1}/${total}`);
        // 每轮从最新 state 读节点和图映射：拓扑排序的目的就是让下游引用上游
        // 刚生成的结果——用批处理开始时的闭包快照收集引用，上游新图永远看不到
        const { nodes: currentNodes, edges: currentEdges, assetImageUrls: curAssetImgs, assetReferenceImages: curAssetRefs, panelImageUrls: curPanelImgs } = latestCanvasRef.current;
        const node = currentNodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const refImages: string[] = [];
        currentEdges.forEach((e) => {
          if (e.target === nodeId) {
            const sourceNode = currentNodes.find((n) => n.id === e.source);
            if (!sourceNode) return;
            const sd = sourceNode.data as Record<string, unknown>;
            const isSrcAsset = sourceNode.type === "asset";
            const img = isSrcAsset
              ? (curAssetImgs?.[sourceNode.id] || curAssetImgs?.[sourceNode.id.slice(6)] || (sd.imageUrl as string) || curAssetRefs?.[sourceNode.id] || curAssetRefs?.[sourceNode.id.slice(6)] || (sd.referenceImage as string))
              : (curPanelImgs?.[sourceNode.id] || (sd.imageUrl as string));
            if (img && !refImages.includes(img)) refImages.push(img as string);
          }
        });

        const prompt =
          node.type === "asset"
            ? (node.data as { description?: string }).description
            : (node.data as { englishImagePrompt?: string }).englishImagePrompt;

        if (!prompt?.trim()) continue;

        const generatedUrl = await handleNodeGenerate(
          nodeId,
          prompt,
          refImages.length > 0 ? refImages : undefined
        );
        if (generatedUrl) {
          successCount++;
        } else {
          errorCount++;
        }
      }
      setBatchProgress("");

      if (successCount > 0 && errorCount === 0) {
        showToast("success", `批量生图完成，${successCount} 个成功`);
      } else if (successCount > 0 && errorCount > 0) {
        showToast("warning", `批量生图完成，${successCount} 个成功，${errorCount} 个失败`);
      } else if (errorCount > 0) {
        showToast("error", `批量生图失败，${errorCount} 个未成功`);
      }
    } finally {
      setIsGenerating(false);
      setBatchProgress("");
    }
  }, [nodes, edges, handleNodeGenerate, setNodes]);

  const handleNodeDescriptionChange = useCallback(
    (nodeId: string, description: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, description } } : n))
      );
    },
    [setNodes]
  );

  const handleNodeReferenceImageChange = useCallback(
    (nodeId: string, image: string | null) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, referenceImage: image ?? undefined } } : n
        )
      );
      console.log("[Plan4Canvas] 参考图变更:", nodeId, "长度:", image?.length ?? 0);
      // 节点 data.referenceImage 会被持久化剥离，不同步存 IndexedDB 则刷新丢失
      const node = nodes.find((n) => n.id === nodeId);
      if (node?.type === "asset" && onAssetReferenceImageChange) {
        console.log("[Plan4Canvas] 资产参考图存 IndexedDB:", nodeId);
        // 只按 nodeId 存——名字不唯一（多个"新资产"），按名字存会互相覆盖
        onAssetReferenceImageChange(nodeId, image);
        // 导入资产节点（id 后半即资产名）额外按资产名存一份，左侧资产面板可见；
        // 手动节点（id 为时间戳）不做这层共享
        if (!/^asset-\d+$/.test(nodeId)) onAssetReferenceImageChange(nodeId.slice(6), image);
      } else if (node?.type === "panel" && onPanelReferenceImageChange) {
        console.log("[Plan4Canvas] 分镜参考图存 IndexedDB:", nodeId);
        onPanelReferenceImageChange(nodeId, image);
      } else {
        console.log("[Plan4Canvas] 参考图未持久化（类型:", node?.type, "）");
      }
    },
    [setNodes, nodes, onAssetReferenceImageChange, onPanelReferenceImageChange]
  );

  const handleNodePromptChange = useCallback(
    (nodeId: string, prompt: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  prompt, // 保存到 prompt 字段
                  englishImagePrompt: prompt, // 兼容旧版本
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  const handleNodeStyleChange = useCallback(
    (nodeId: string, styleValue: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, styleValue, name: STYLE_CONFIGS[styleValue]?.label || styleValue } } : n
        )
      );
    },
    [setNodes]
  );

  const handleNodeConsistencyLockChange = useCallback(
    (nodeId: string, locked: boolean) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, consistencyLock: locked } } : n
        )
      );
      showToast("info", locked ? "角色一致性已锁定" : "角色一致性已解锁");
    },
    [setNodes]
  );

  const handleAspectRatioChange = useCallback(
    (nodeId: string, ratio: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, aspectRatio: ratio } } : n
        )
      );
    },
    [setNodes]
  );

  // 删除时清理的图片 key 按节点 id 形态区分：
  // - 手动节点（asset-{时间戳}）：图完全属于节点，清 [nodeId, 去前缀 id] 两种历史 key
  // - 导入资产节点（asset-{资产名}）：nodeId key 属画布；去前缀=资产名的 key 与左侧
  //   资产面板共享（左侧按资产名存图），删画布节点不能把左侧还在用的图清掉。
  // 不清 data.name 对应的 key——名字不唯一（多个"新资产"），按名字清会误删同名节点的图。
  const assetImageKeysForNode = (nodeId: string): string[] =>
    /^asset-\d+$/.test(nodeId) ? [nodeId, nodeId.slice(6)] : [nodeId];

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      console.log("[Plan4Canvas] 删除节点:", nodeId, node?.type);
      if (node?.type === "asset") {
        console.log("[Plan4Canvas] 清除资产图片:", nodeId);
        const keys = assetImageKeysForNode(nodeId);
        onClearAssetImage?.(keys);
        // 同时清除参考图（与生成图同一组 key）
        for (const key of keys) onAssetReferenceImageChange?.(key, null);
      } else if (node?.type === "panel") {
        console.log("[Plan4Canvas] 清除分镜图片:", nodeId);
        onClearPanelImage?.(nodeId);
        // 同时清除参考图
        onPanelReferenceImageChange?.(nodeId, null);
      }
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      // 延迟显示 toast，避免在渲染过程中更新 state
      setTimeout(() => showToast("info", "节点已删除"), 0);
    },
    [setNodes, setEdges, nodes, onClearPanelImage, onClearAssetImage, onAssetReferenceImageChange, onPanelReferenceImageChange]
  );

  const handleOpenDetail = useCallback((nodeId: string) => {
    setDetailNodeId(nodeId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailNodeId(null);
  }, []);

  const handleDetailUpdate = useCallback(
    (patch: Record<string, unknown>) => {
      if (!detailNodeId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === detailNodeId ? { ...n, data: { ...n.data, ...patch } } : n))
      );
    },
    [detailNodeId, setNodes]
  );

  const handleDetailGenerate = useCallback(() => {
    if (!detailNodeId) return;
    const node = nodes.find((n) => n.id === detailNodeId);
    if (!node) return;
    if (node.type === "asset") {
      const d = node.data as Record<string, unknown>;
      handleNodeGenerate(detailNodeId, (d.description as string) || "", d.referenceImage ? [d.referenceImage as string] : undefined);
    } else if (node.type === "panel") {
      const d = node.data as Record<string, unknown>;
      handleNodeGenerate(detailNodeId, (d.englishImagePrompt as string) || "");
    }
  }, [detailNodeId, nodes, handleNodeGenerate]);

  const handleDetailDelete = useCallback(() => {
    if (!detailNodeId) return;
    handleNodeDelete(detailNodeId);
    setDetailNodeId(null);
  }, [detailNodeId, handleNodeDelete]);

  // 详情面板当前节点数据（含外部图片映射）
  const detailNode = nodes.find((n) => n.id === detailNodeId);
  const detailNodeData: Record<string, unknown> = detailNode
    ? (() => {
        const d = detailNode.data as Record<string, unknown>;
        const isAsset = detailNode.type === "asset";
        const isPanel = detailNode.type === "panel";
        return {
          ...d,
          imageUrl: isAsset
            ? (assetImageUrls?.[detailNode.id] || assetImageUrls?.[detailNode.id.slice(6)] || d.imageUrl)
            : isPanel
              ? (panelImageUrls?.[detailNode.id] || d.imageUrl)
              : d.imageUrl,
          referenceImage: isAsset
            ? (assetReferenceImages?.[detailNode.id] || assetReferenceImages?.[detailNode.id.slice(6)] || d.referenceImage)
            : d.referenceImage,
        };
      })()
    : {};

  // 注入回调 + 外部图片映射到节点数据中（避免图片直接存入画布状态导致 localStorage 超限）
  const nodesWithCallbacks = useMemo(() => nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    const isAsset = n.type === "asset";
    const isPanel = n.type === "panel";
    const isStyle = n.type === "style";
    const isVideo = n.type === "video";

    // 计算该节点的上游参考图
    const connectedRefImages: { url: string; name: string; nodeId: string }[] = [];
    if (isAsset || isPanel) {
      edges.forEach((e) => {
        if (e.target === n.id) {
          const sourceNode = nodes.find((nn) => nn.id === e.source);
          if (!sourceNode) return;
          const sd = sourceNode.data as Record<string, unknown>;
          const isSrcAsset = sourceNode.type === "asset";
          const srcName = isSrcAsset ? (sd.name as string) : `分镜 #${(sd.panelId as number) ?? ""}`;
          const img = isSrcAsset
            ? (assetImageUrls?.[sourceNode.id] || assetImageUrls?.[sourceNode.id.slice(6)] || (sd.imageUrl as string) || assetReferenceImages?.[sourceNode.id] || assetReferenceImages?.[sourceNode.id.slice(6)] || (sd.referenceImage as string))
            : (panelImageUrls?.[sourceNode.id] || (sd.imageUrl as string));
          if (img && !connectedRefImages.some((r) => r.url === img)) {
            connectedRefImages.push({ url: img as string, name: srcName || sourceNode.id, nodeId: sourceNode.id });
          }
        }
      });
    }

    // 计算风格
    const style = isAsset || isPanel ? getNodeStyle(n.id) : null;

    // 计算一致性信息
    const lockedChars = isAsset || isPanel ? getLockedCharacters() : [];
    const consistencyInfo = lockedChars.length > 0 ? {
      name: lockedChars.map((c) => c.name).join(", "),
      prompt: lockedChars.map((c) => c.consistencyPrompt).filter(Boolean).join("; ") || "角色一致性已启用",
    } : null;

    // VideoNode 使用专门的视频生成回调
    const onGenerateForNode = isVideo ? handleVideoNodeGenerate : handleNodeGenerate;

    return {
      ...n,
      data: {
        ...d,
        // 资产图按节点 id 双查（id + 去前缀）：手动节点 id 为时间戳、导入节点 id 后半
        // 即资产名（覆盖左侧面板按资产名存的图）。不按 data.name 直查——名字不唯一，
        // 多个"新资产"节点会互相串图。
        imageUrl: isAsset
          ? (assetImageUrls?.[n.id] || assetImageUrls?.[n.id.slice(6)] || d.imageUrl)
          : isPanel
            ? (panelImageUrls?.[n.id] || d.imageUrl)
            : d.imageUrl,
        referenceImage: isAsset
          ? (assetReferenceImages?.[n.id] || assetReferenceImages?.[n.id.slice(6)] || d.referenceImage)
          : isPanel
            ? (panelReferenceImages?.[n.id] || d.referenceImage)
            : d.referenceImage,
        connectedRefImages,
        activeStyle: style?.value || null,
        activeStyleColor: style?.color || null,
        consistencyInfo,
        onGenerate: onGenerateForNode,
        onDescriptionChange: handleNodeDescriptionChange,
        onReferenceImageChange: handleNodeReferenceImageChange,
        onPromptChange: handleNodePromptChange,
        onStyleChange: isStyle ? handleNodeStyleChange : undefined,
        onConsistencyLockChange: isAsset ? handleNodeConsistencyLockChange : undefined,
        onAspectRatioChange: handleAspectRatioChange,
        onDelete: handleNodeDelete,
        onImportVideo: isVideo ? handleImportVideo : undefined,
        onRefetchVideoUrl: isVideo ? handleRefetchVideoUrl : undefined,
        // 文本引擎配置（润色用）：透传给 VideoNode
        textApiKey: isVideo ? textApiKey : undefined,
        textProvider: isVideo ? textProvider : undefined,
        textModel: isVideo ? textModel : undefined,
        textBaseUrl: isVideo ? textBaseUrl : undefined,
        onOpenDetail: handleOpenDetail,
        onOpenGenerationMode: isPanel
          ? (nodeId: string) => {
              setGenerationModeNodeId(nodeId);
              setGenerationModeOpen(true);
            }
          : undefined,
        onEditImage: isPanel || isAsset
          ? (nodeId: string) => {
              setEditDialogNodeId(nodeId);
              setEditDialogOpen(true);
            }
          : undefined,
        onVariantImage: isPanel
          ? (nodeId: string) => {
              setVariantDialogNodeId(nodeId);
              setVariantDialogOpen(true);
            }
          : undefined,
        onOutpaintImage: isPanel
          ? (nodeId: string) => {
              const panelNode = nodes.find((nn) => nn.id === nodeId);
              if (!panelNode) return;
              const pd = panelNode.data as Record<string, unknown>;
              const prompt = (pd.englishImagePrompt as string) || "";
              const outpaintPrompt = `${prompt}\n\nWiden the scene. Show more of the surrounding environment while keeping the original subject in the center. Maintain the same art style and lighting.`;
              handleNodeGenerate(nodeId, outpaintPrompt);
            }
          : undefined,
      },
    };
  }), [
    nodes,
    edges,
    assetImageUrls,
    assetReferenceImages,
    panelImageUrls,
    getNodeStyle,
    getLockedCharacters,
    handleNodeGenerate,
    handleVideoNodeGenerate,
    handleImportVideo,
    handleRefetchVideoUrl,
    handleNodeDescriptionChange,
    handleNodeReferenceImageChange,
    handleNodePromptChange,
    handleNodeStyleChange,
    handleNodeConsistencyLockChange,
    handleAspectRatioChange,
    handleNodeDelete,
    handleOpenDetail,
  ]);

  // 生图模式面板数据
  const generationModeNode = generationModeNodeId ? nodes.find((n) => n.id === generationModeNodeId) : null;

  // 处理生图模式生成
  const handleGenerationModeGenerate = useCallback(
    async (
      mode: GenerationMode,
      prompt: string,
      referenceImages?: string[],
      options?: VideoGenerationOptions
    ) => {
      if (!generationModeNodeId) return;

      // 根据模式调用不同的生成函数
      switch (mode) {
        case "gpt-image2-storyboard":
        case "asset-reference-sheet":
          // 图片生成
          await handleNodeGenerate(generationModeNodeId, prompt, referenceImages);
          break;
        case "seedance-text-to-video":
        case "seedance-image-to-video":
        case "zzdh-text-to-video":
        case "zzdh-first-last-frame":
        case "zzdh-multi-reference":
        case "zzdh-multi-image-audio":
        case "zzdh-lip-sync":
          await handleNodeVideoGenerate(generationModeNodeId, mode, prompt, referenceImages, options);
          break;
      }

      // 关闭生图模式面板
      setGenerationModeOpen(false);
    },
    [generationModeNodeId, handleNodeGenerate, handleNodeVideoGenerate]
  );

  // 图片编辑对话框数据
  const editDialogNode = editDialogNodeId ? nodes.find((n) => n.id === editDialogNodeId) : null;
  const editDialogImageUrl = editDialogNode
    ? (() => {
        const nodeData = editDialogNode.data as Record<string, unknown>;
        // 与节点注入同规则：按节点 id 双查，不按 data.name（名字不唯一）
        return (
          (panelImageUrls?.[editDialogNode.id] as string) ||
          (assetImageUrls?.[editDialogNode.id] as string) ||
          (assetImageUrls?.[editDialogNode.id.slice(6)] as string) ||
          (nodeData.imageUrl as string) ||
          (nodeData.referenceImage as string) ||
          ""
        );
      })()
    : "";
  const editDialogPrompt = editDialogNode
    ? ((editDialogNode.data as Record<string, unknown>).englishImagePrompt as string) || ""
    : "";

  const handleEditGenerate = useCallback(
    async (instruction: string, referenceImage: string) => {
      const prompt = `Based on the reference image, ${instruction}. Keep the same character/scene composition and art style.`;
      return await handleNodeGenerate(editDialogNodeId!, prompt, [referenceImage]);
    },
    [handleNodeGenerate, editDialogNodeId]
  );

  // 变体生成对话框数据
  const variantDialogNode = variantDialogNodeId ? nodes.find((n) => n.id === variantDialogNodeId) : null;
  const variantDialogImageUrl = variantDialogNode
    ? (panelImageUrls?.[variantDialogNode.id] || (variantDialogNode.data as Record<string, unknown>).imageUrl as string)
    : "";
  const variantDialogPrompt = variantDialogNode
    ? ((variantDialogNode.data as Record<string, unknown>).englishImagePrompt as string) || ""
    : "";

  const handleVariantGenerate = useCallback(
    async (count: number, referenceImage: string, prompt: string) => {
      const urls: string[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const url = await handleNodeGenerate(variantDialogNodeId!, prompt, [referenceImage]);
          if (url) urls.push(url);
        } catch {
          // skip failed variants
        }
      }
      return urls;
    },
    [handleNodeGenerate, variantDialogNodeId]
  );

  const handleVariantSelect = useCallback(
    (url: string) => {
      if (!variantDialogNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === variantDialogNodeId ? { ...n, data: { ...n.data, imageUrl: url } } : n
        )
      );
    },
    [variantDialogNodeId, setNodes]
  );

  // 角色特征提取
  const handleExtractCharacter = useCallback(
    async (imageBase64: string) => {
      try {
        const res = await fetch("/api/extract-character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        const data = await res.json();
        return data as { features?: string } | null;
      } catch {
        return null;
      }
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      // 如果右键发生了移动（拖动），则不显示菜单
      if (hasRightMouseMoved.current) {
        return;
      }
      const clientX = (event as React.MouseEvent).clientX ?? (event as MouseEvent).clientX;
      const clientY = (event as React.MouseEvent).clientY ?? (event as MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setContextMenu({
        x: clientX,
        y: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        visible: true,
      });
    },
    [screenToFlowPosition]
  );

  const onPaneClick = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
    // 点击空白处取消全部选中 → 各节点的浮动面板自动收起
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
  }, [setNodes]);

  // 点击画布区域之外（工具栏、侧边栏等）也取消选中 → 浮动面板收起
  useEffect(() => {
    const handleCanvasOutsideClick = (event: MouseEvent) => {
      // 注意：此处 Node 指 DOM Node（instanceof 不会走 xyflow 的类型遮蔽）
      const target = event.target;
      if (canvasContainerRef.current && target instanceof Node && !canvasContainerRef.current.contains(target)) {
        setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
      }
    };
    document.addEventListener("mousedown", handleCanvasOutsideClick);
    return () => document.removeEventListener("mousedown", handleCanvasOutsideClick);
  }, [setNodes]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu.visible]);

  const assistantPrompts = [
    "先顺一顺分镜节奏",
    "检查角色一致性",
    "补齐缺失参考图",
  ];

  const handleAssistantSubmit = useCallback(async (instruction?: string) => {
    const finalInstruction = (instruction ?? assistantInput).trim();
    if (!finalInstruction || assistantLoading) return;
    if (!textApiKey?.trim()) {
      setAssistantError("请先在左侧配置文本模型 API Key。");
      return;
    }

    const cleanNodes = nodes.map((node) => {
      const data = { ...(node.data as Record<string, unknown>) };
      delete data.imageUrl;
      delete data.referenceImage;
      return { ...node, data };
    });

    setAssistantLoading(true);
    setAssistantError("");
    try {
      const res = await fetch("/api/plan4/canvas-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: finalInstruction,
          canvas: {
            nodes: cleanNodes,
            edges,
          },
          textProvider,
          textModel,
          textBaseUrl,
          textApiKey,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        result?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || `助手请求失败 (${res.status})`);
      }
      setAssistantInput(finalInstruction);
      setAssistantResult(data.result || "助手没有返回内容。");
    } catch (err) {
      setAssistantError(err instanceof Error ? err.message : "助手请求失败");
    } finally {
      setAssistantLoading(false);
    }
  }, [
    assistantInput,
    assistantLoading,
    edges,
    nodes,
    textApiKey,
    textBaseUrl,
    textModel,
    textProvider,
  ]);

  return (
    <div ref={canvasContainerRef} className={`relative h-full w-full bg-black bg-dot-grid ${isRightMouseDragging ? "canvas-performance-moving" : ""}`}>
      <div className="pointer-events-none absolute left-4 top-3 z-30 flex items-center gap-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 shadow-2xl backdrop-blur-xl">
          <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-300 text-[11px] font-black text-black">
            AI
          </div>
          <div className="min-w-0">
            <div className="max-w-[180px] truncate text-sm font-semibold text-zinc-100">
              AI Comic Pro
            </div>
            <div className="text-[10px] text-zinc-500">
              {assetCount} 资产 / {panelCount} 分镜 / {doneCount} 已生成
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-3 z-30 flex items-center gap-2">
        <button
          type="button"
          className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 text-xs font-medium text-zinc-300 shadow-2xl backdrop-blur-xl transition-colors hover:bg-zinc-900/90 hover:text-zinc-100"
          title="生成余量"
        >
          <Sparkles className="size-3.5 text-violet-300" />
          {doneCount}/{Math.max(nodes.length, 1)}
        </button>
        <button
          type="button"
          onClick={() => setAssetLibraryOpen(true)}
          className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 text-xs font-medium text-zinc-300 shadow-2xl backdrop-blur-xl transition-colors hover:bg-zinc-900/90 hover:text-zinc-100"
          title="资产库"
        >
          <FolderOpen className="size-3.5 text-cyan-300" />
          资产库
        </button>
        <button
          type="button"
          onClick={() => setAssistantOpen((open) => !open)}
          className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 text-xs font-medium text-zinc-300 shadow-2xl backdrop-blur-xl transition-colors hover:bg-zinc-900/90 hover:text-zinc-100"
          title={assistantOpen ? "收起创作助手" : "展开创作助手"}
        >
          {assistantOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
          助手
        </button>
        <button
          type="button"
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/80 text-zinc-300 shadow-2xl backdrop-blur-xl transition-colors hover:bg-zinc-900/90 hover:text-zinc-100"
          title="分享画布"
        >
          <Share2 className="size-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute left-4 top-1/2 z-30 -translate-y-1/2">
        <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-full border border-white/10 bg-zinc-950/80 p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              const center = getViewportCenter();
              handleAddAsset(center.x - 110, center.y - 160);
            }}
            className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
            title="添加资产"
          >
            <Plus className="size-5" />
          </button>
          <button
            type="button"
            onClick={handleImportAssets}
            className="flex size-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
            title="导入资产"
          >
            <FolderOpen className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleImportPanels}
            className="flex size-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
            title="导入分镜"
          >
            <Film className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleBatchGenerate}
            disabled={isGenerating}
            className="flex size-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-violet-950/70 hover:text-violet-200 disabled:opacity-40"
            title="批量生成"
          >
            {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          </button>
          <div className="my-1 h-px w-5 bg-zinc-800" />
          <button
            type="button"
            onClick={() => setLogsOpen((open) => !open)}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              logsOpen ? "bg-emerald-950/60 text-emerald-300" : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
            }`}
            title="生成日志"
          >
            <Activity className="size-4" />
          </button>
        </div>
      </div>

      {assistantOpen && (
        <aside className="pointer-events-none absolute right-0 top-0 z-20 flex h-full w-[clamp(360px,34vw,520px)] items-center justify-end bg-gradient-to-l from-black/70 via-black/35 to-transparent pr-4">
          <div className="pointer-events-auto w-full rounded-2xl border border-white/10 bg-[#171717]/95 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <MessageSquare className="size-4 text-violet-300" />
                  创作助手
                </div>
                <p className="mt-1 text-xs text-zinc-500">把画布内容、参考图和分镜策略串起来。</p>
              </div>
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title="关闭"
              >
                <PanelRightClose className="size-4" />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              {assistantPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setAssistantInput(prompt);
                    void handleAssistantSubmit(prompt);
                  }}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-3">
              <textarea
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                className="h-28 w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                placeholder="描述你的创意或需求。可以先导入画布内容，再引用资产、分镜或风格节点。"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleImportAssets}
                  className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  添加画布内容
                </button>
                <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-500">@ 引用</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => void handleAssistantSubmit()}
                  disabled={assistantLoading || !assistantInput.trim()}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                >
                  {assistantLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  {assistantLoading ? "分析中" : "分析画布"}
                </button>
              </div>
            </div>

            {(assistantResult || assistantError) && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-zinc-800/80 bg-black/40 p-3 [scrollbar-color:theme(colors.zinc.700)_transparent] [scrollbar-width:thin]">
                {assistantError ? (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-red-300">
                    {assistantError}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
                    {assistantResult}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-2 py-2">
                <div className="text-base font-semibold text-zinc-100">{assetCount}</div>
                <div className="text-[10px] text-zinc-500">资产</div>
              </div>
              <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-2 py-2">
                <div className="text-base font-semibold text-zinc-100">{panelCount}</div>
                <div className="text-[10px] text-zinc-500">分镜</div>
              </div>
              <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-2 py-2">
                <div className="text-base font-semibold text-zinc-100">{pendingCount}</div>
                <div className="text-[10px] text-zinc-500">进行中</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* 资产库抽屉 */}
      {assetLibraryOpen && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAssetLibraryOpen(false)} />
          <aside className="absolute right-0 top-0 z-10 flex h-full w-[360px] flex-col border-l border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-4 text-cyan-300" />
                <span className="text-sm font-semibold text-zinc-100">资产库</span>
              </div>
              <button
                type="button"
                onClick={() => setAssetLibraryOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {(() => {
                const groups: { label: string; items: { name: string; description: string }[] }[] = [];
                const ar = analysisResult;
                if (ar) {
                  if (ar.characters?.length) groups.push({ label: "角色", items: ar.characters });
                  if (ar.creatures?.length) groups.push({ label: "生物", items: ar.creatures });
                  if (ar.scenes?.length) groups.push({ label: "场景", items: ar.scenes });
                  if (ar.props?.length) groups.push({ label: "道具", items: ar.props });
                  if (ar.cockpits?.length) groups.push({ label: "座舱", items: ar.cockpits });
                }
                if (groups.length === 0) {
                  return (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                      <FolderOpen className="size-8 text-zinc-700" />
                      <p className="text-xs text-zinc-500">暂无资产数据</p>
                      <p className="text-[10px] text-zinc-600">先在「剧本」里分析剧本生成资产</p>
                    </div>
                  );
                }
                return groups.map((group) => (
                  <div key={group.label} className="mb-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-400">{group.label}</span>
                      <span className="rounded-full bg-zinc-800/60 px-1.5 py-0.5 text-[9px] text-zinc-500">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const img = assetImageUrls?.[item.name] || assetReferenceImages?.[item.name];
                        return (
                          <div
                            key={item.name}
                            className="group/card overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700"
                            title={item.description}
                          >
                            <div className="flex h-20 w-full items-center justify-center bg-zinc-950/60">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[9px] text-zinc-600">未生成</span>
                              )}
                            </div>
                            <div className="truncate px-2 py-1.5 text-[10px] text-zinc-300">{item.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </aside>
        </div>
      )}

      {isGenerating && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full border border-amber-500/20 bg-black/80 px-4 py-2 text-xs text-amber-100 shadow-2xl backdrop-blur-xl">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-amber-300" />
            {batchProgress || "正在生成画布内容"}
          </span>
        </div>
      )}

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={(deletedNodes) => {
          // 键盘删除（Backspace/Delete）不走 handleNodeDelete，这里补上图片+参考图清理。
          // 参考图漏清会导致：删除卡片后重建同名节点（如默认名"新资产"）直接命中
          // assetReferenceImages 里的残留 key，上传过的参考图"复活"。
          for (const node of deletedNodes) {
            if (node.type === "asset") {
              const keys = assetImageKeysForNode(node.id);
              onClearAssetImage?.(keys);
              for (const key of keys) onAssetReferenceImageChange?.(key, null);
            } else if (node.type === "panel") {
              onClearPanelImage?.(node.id);
              onPanelReferenceImageChange?.(node.id, null);
            }
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onPointerDown={(event) => {
          // 右键按下开始拖动画布
          if (event.button === 2) {
            event.preventDefault();
            setIsRightMouseDragging(true);
            const viewport = getViewport();
            rightMouseDragStart.current = {
              x: event.clientX,
              y: event.clientY,
              viewportX: viewport.x,
              viewportY: viewport.y,
            };
            // 记录起始位置用于区分点击和拖动
            rightMouseStartPos.current = { x: event.clientX, y: event.clientY };
            hasRightMouseMoved.current = false;
          }
        }}
        onPointerMove={(event) => {
          // 右键拖动中
          if (isRightMouseDragging && rightMouseDragStart.current) {
            const dx = event.clientX - rightMouseDragStart.current.x;
            const dy = event.clientY - rightMouseDragStart.current.y;
            const zoom = getViewport().zoom;
            setViewport({
              x: rightMouseDragStart.current.viewportX + dx / zoom,
              y: rightMouseDragStart.current.viewportY + dy / zoom,
              zoom,
            }, { duration: 0 });
            // 画布正在移动，通知弹窗关闭
            window.dispatchEvent(new CustomEvent("canvas-viewport-moving"));
          }
          // 检测右键是否移动超过阈值，用于区分点击和拖动
          if (rightMouseStartPos.current && !hasRightMouseMoved.current) {
            const moveThreshold = 5;
            const dx = event.clientX - rightMouseStartPos.current.x;
            const dy = event.clientY - rightMouseStartPos.current.y;
            if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
              hasRightMouseMoved.current = true;
            }
          }
        }}
        onPointerUp={() => {
          // 右键释放结束拖动
          if (isRightMouseDragging) {
            setIsRightMouseDragging(false);
            rightMouseDragStart.current = null;
          }
          // 重置右键点击/拖动检测状态（延迟一点，让 contextmenu 事件先处理）
          setTimeout(() => {
            rightMouseStartPos.current = null;
            hasRightMouseMoved.current = false;
          }, 50);
        }}
        fitView
        attributionPosition="bottom-left"
        // 选择/框选配置：左键用于框选和拖动节点，右键用于平移画布
        panOnDrag={[2]}               // 只有右键(2)可以平移画布，左键用于框选
        selectionOnDrag={true}        // 左键在空白处拖动创建框选区域
        selectNodesOnDrag={true}      // 拖动节点时选中
        multiSelectionKeyCode="Shift" // Shift+点击多选
        selectionMode={SelectionMode.Partial}  // 框选时只需要触及一部分
        className={`xyq-canvas ${isRightMouseDragging ? 'cursor-grabbing' : 'cursor-default'}`}
      >
        {/* 小云雀点阵：gap 40 / size 2 / #c1c1c1（实测） */}
        <Background variant={BackgroundVariant.Dots} gap={40} size={2} color="#c1c1c1" />

        <Controls
          position="bottom-right"
          className="!mb-5 !mr-4 !shadow-none"
          showInteractive={false}
        />
        <MiniMap
          className="!bottom-4 !left-4 !w-[140px] !h-[100px]"
          nodeColor={(node) => {
            if (node.type === "asset") return "#6366f1";
            if (node.type === "panel") return "#a855f7";
            if (node.type === "style") return "#ec4899";
            return "#a1a1aa";
          }}
          maskColor="rgba(242, 242, 242, 0.65)"
        />
        <Panel position="bottom-center" className="!mb-5">
          <CanvasToolbar
            onImportAssets={handleImportAssets}
            onImportPanels={handleImportPanels}
            onBatchGenerate={handleBatchGenerate}
            onExport={handleExport}
            onClear={handleClear}
            onAddAsset={() => {
              const center = getViewportCenter();
              handleAddAsset(center.x - 110, center.y - 160);
            }}
            onAddPanel={() => {
              const center = getViewportCenter();
              handleAddPanel(center.x - 130, center.y - 200);
            }}
            onAddStyle={() => {
              setStyleLibraryOpen(true);
            }}
            onAddVideo={() => {
              const center = getViewportCenter();
              handleAddVideo(center.x - 140, center.y - 90);
            }}
            onToggleLogs={() => setLogsOpen((o) => !o)}
            logsOpen={logsOpen}
            isGenerating={isGenerating}
            batchProgress={batchProgress}
          />
        </Panel>
      </ReactFlow>

      {contextMenu.visible && (
        <div className="xyq-pop absolute z-50 w-[200px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            type="button"
            onClick={() => handleAddAsset(contextMenu.flowX, contextMenu.flowY)}
            className="xyq-pop-item"
          >
            <span>🧑</span> 添加资产节点
          </button>
          <button
            type="button"
            onClick={() => handleAddPanel(contextMenu.flowX, contextMenu.flowY)}
            className="xyq-pop-item"
          >
            <span>🎬</span> 添加分镜节点
          </button>
          <button
            type="button"
            onClick={() => handleAddStyle(contextMenu.flowX, contextMenu.flowY)}
            className="xyq-pop-item"
          >
            <span>🎨</span> 添加风格节点
          </button>
          <button
            type="button"
            onClick={() => handleAddVideo(contextMenu.flowX, contextMenu.flowY)}
            className="xyq-pop-item"
          >
            <span>🎥</span> 添加视频节点
          </button>
        </div>
      )}

      <ImportDialog
        open={importOpen}
        title={importTitle}
        items={importItems}
        onClose={() => setImportOpen(false)}
        onConfirm={importMode === "asset" ? handleConfirmImportAssets : handleConfirmImportPanels}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        danger
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* 风格库 */}
      <StyleLibrary
        open={styleLibraryOpen}
        onClose={() => setStyleLibraryOpen(false)}
        onSelect={(styleId) => {
          showToast("success", `已选择风格: ${styleId}`);
          setStyleLibraryOpen(false);
        }}
      />

      <CreatePanelDialog
        open={createPanelOpen}
        suggestedId={(() => {
          const existingIds = nodes
            .filter((n) => n.type === "panel")
            .map((n) => (n.data as any).panelId as number)
            .filter((id) => typeof id === "number")
            .sort((a, b) => a - b);
          // 找第一个空缺的编号（删除分镜后从头补缺，而不是 max+1）
          let next = 1;
          for (const id of existingIds) {
            if (id === next) next++;
            else break;
          }
          return next;
        })()}
        onClose={() => {
          setCreatePanelOpen(false);
          setPendingPanelPosition(null);
        }}
        onConfirm={handleConfirmCreatePanel}
      />

      {/* 右下角日志浮窗 */}
      {logsOpen && (
        <div className="absolute bottom-4 right-4 z-40 w-[340px] max-h-[400px] overflow-hidden rounded-xl border border-zinc-800/60 glass-strong shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/40">
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
              <Activity className="size-3.5 text-emerald-400" />
              生图日志
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-950/60 px-1.5 py-0.5 text-[10px] text-amber-400">
                  <Loader2 className="size-2.5 animate-spin" />
                  {pendingCount}
                </span>
              )}
            </span>
            <span className="text-[10px] text-zinc-600">{logs.length} 条</span>
          </div>
          <div ref={logsScrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {logs.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-600">暂无日志</p>
            ) : (
              logs.map((log) => {
                const expanded = expandedLogId === log.id;
                return (
                <div key={log.id} className="rounded-lg bg-zinc-950/50 px-2 py-1.5 text-[11px] border border-zinc-800/30">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 text-left"
                    onClick={() => setExpandedLogId(expanded ? null : log.id)}
                  >
                    {log.status === "pending" && <Loader2 className="size-3 animate-spin text-amber-400" />}
                    {log.status === "success" && <CheckCircle2 className="size-3 text-emerald-400" />}
                    {log.status === "error" && <XCircle className="size-3 text-red-400" />}
                    <span className="font-mono text-zinc-600">{formatLogTime(log.timestamp)}</span>
                    <span className="rounded bg-zinc-800/60 px-1 text-[10px] text-zinc-400">{log.provider}</span>
                    <span className="truncate text-zinc-600">{log.model}</span>
                    {log.durationMs > 0 && <span className="ml-auto shrink-0 text-zinc-600">{log.durationMs}ms</span>}
                    {expanded ? <ChevronDown className="size-3 shrink-0 text-zinc-600" /> : <ChevronRight className="size-3 shrink-0 text-zinc-600" />}
                  </button>
                  <p className="mt-0.5 truncate text-zinc-300" title={log.prompt}>{log.prompt}</p>
                  {log.error && <p className="mt-0.5 truncate text-red-400" title={log.error}>{log.error}</p>}
                  {expanded && (
                    <div className="mt-2 space-y-1 rounded border border-zinc-800/60 bg-black/40 p-2 text-[10px] leading-relaxed">
                      <p className="break-all text-zinc-600">id: {log.id}</p>
                      <p className="break-all text-zinc-600">baseUrl: {log.baseUrl || "(default)"}</p>
                      <p className="whitespace-pre-wrap break-words text-zinc-300">{log.prompt}</p>
                      {log.error && <p className="whitespace-pre-wrap break-words text-red-300">{log.error}</p>}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 图片编辑对话框 */}
      <ImageEditDialog
        open={editDialogOpen}
        imageUrl={editDialogImageUrl}
        originalPrompt={editDialogPrompt}
        onClose={() => setEditDialogOpen(false)}
        onGenerate={handleEditGenerate}
      />

      {/* 变体生成对话框 */}
      <VariantDialog
        open={variantDialogOpen}
        imageUrl={variantDialogImageUrl}
        originalPrompt={variantDialogPrompt}
        onClose={() => setVariantDialogOpen(false)}
        onGenerate={handleVariantGenerate}
        onSelect={handleVariantSelect}
      />

      {/* 右侧详情面板 */}
      {detailNode && (
        <DetailPanel
          open={!!detailNodeId}
          nodeType={detailNode.type === "asset" ? "asset" : "panel"}
          nodeId={detailNodeId ?? ""}
          data={detailNodeData}
          onClose={handleCloseDetail}
          onUpdate={handleDetailUpdate}
          onGenerate={handleDetailGenerate}
          onDelete={handleDetailDelete}
          onExtractCharacter={handleExtractCharacter}
        />
      )}

      {/* 生图模式面板 */}
      {generationModeNode && (
        <GenerationModePanel
          open={generationModeOpen}
          nodeId={generationModeNodeId || ""}
          persistedReferenceImages={
            generationModeNodeId && panelReferenceImages?.[generationModeNodeId]
              ? (() => {
                  try {
                    const parsed = JSON.parse(panelReferenceImages[generationModeNodeId]);
                    return Array.isArray(parsed) ? parsed : undefined;
                  } catch {
                    return undefined;
                  }
                })()
              : undefined
          }
          onPersistReferenceImages={(nodeId, images) =>
            onPanelReferenceImageChange?.(nodeId, images.length > 0 ? JSON.stringify(images) : null)
          }
          panelData={{
            panelId: (generationModeNode.data as Record<string, unknown>).panelId as number,
            storyBeat: (generationModeNode.data as Record<string, unknown>).storyBeat as string,
            englishImagePrompt: (generationModeNode.data as Record<string, unknown>).englishImagePrompt as string,
            chineseDirectorNotes: (generationModeNode.data as Record<string, unknown>).chineseDirectorNotes as string,
            cinematography: (generationModeNode.data as Record<string, unknown>).cinematography as Record<string, unknown>,
            firstFrame: (generationModeNode.data as Record<string, unknown>).firstFrame as Record<string, string>,
            lastFrame: (generationModeNode.data as Record<string, unknown>).lastFrame as Record<string, string>,
            characters: (generationModeNode.data as Record<string, unknown>).characters as string[],
            location: (generationModeNode.data as Record<string, unknown>).location as string,
            props: (generationModeNode.data as Record<string, unknown>).props as string[],
          }}
          context={{
            characters: analysisResult?.characters?.map((c) => ({
              name: c.name,
              appearance: c.description || "",
              outfit: "默认服装",
            })) || [],
            location: {
              name: analysisResult?.scenes?.[0]?.name || "默认场景",
              description: analysisResult?.scenes?.[0]?.description || "",
            },
            artStyle: "赛博朋克风格",
          }}
          onClose={() => setGenerationModeOpen(false)}
          onGenerate={handleGenerationModeGenerate}
          isGenerating={Boolean((generationModeNode.data as Record<string, unknown>).isGenerating)}
          videoGenerationEnabled={Boolean(videoApiKey?.trim())}
          existingImageUrl={panelImageUrls?.[generationModeNodeId || ""] || (generationModeNode.data as Record<string, unknown>).imageUrl as string}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default function Plan4Canvas(props: Plan4CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
