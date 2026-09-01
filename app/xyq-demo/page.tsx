"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./xyq.css";
import TopBar from "./TopBar";
import LeftRail from "./LeftRail";
import type { CreateKind } from "./types";
import BottomBar from "./BottomBar";
import AiPanel from "./AiPanel";
import SelectionComposer from "./SelectionComposer";
import NodeContextMenu from "./NodeContextMenu";
import { demoNodeTypes } from "./nodes";
import type { DemoNodeData } from "./types";

/* ---------- mock 初始数据 ---------- */
const GRAD = {
  violet: "linear-gradient(135deg, #667eea, #764ba2)",
  rose: "linear-gradient(135deg, #f093fb, #f5576c)",
  blue: "linear-gradient(135deg, #4facfe, #00f2fe)",
  amber: "linear-gradient(135deg, #ffe259, #ffa751)",
  slate: "linear-gradient(135deg, #e9e9ef, #d5d5dc)",
};

function seedNodes(handlers: Handlers): Node<DemoNodeData>[] {
  const mk = (
    id: string,
    type: string,
    data: DemoNodeData,
    position: { x: number; y: number },
  ): Node<DemoNodeData> => ({
    id,
    type,
    position,
    data: { ...data, ...handlers.wrap(id) },
  });
  return [
    mk(
      "n1",
      "demoImage",
      {
        id: "n1",
        title: "角色 · 星际旅人",
        kind: "image",
        status: "done",
        gradient: GRAD.violet,
        tag: "主角",
      },
      { x: -430, y: -240 },
    ),
    mk(
      "n2",
      "demoImage",
      {
        id: "n2",
        title: "场景 · 雨夜霓虹城",
        kind: "image",
        status: "done",
        gradient: GRAD.rose,
      },
      { x: -50, y: -280 },
    ),
    mk(
      "n3",
      "demoVideo",
      {
        id: "n3",
        title: "分镜 01 · 开场",
        kind: "video",
        status: "done",
        gradient: GRAD.blue,
        meta: "00:08",
      },
      { x: 360, y: -260 },
    ),
    mk(
      "n4",
      "demoText",
      {
        id: "n4",
        title: "旁白 · 第一幕",
        kind: "text",
        status: "draft",
        gradient: GRAD.amber,
        tag: "草稿",
        text: "雨点敲打在霓虹灯牌上，她收起伞，走进这条从未有人回来的巷子……",
        meta: "42 字 · 尚未发布",
      },
      { x: -360, y: 90 },
    ),
    mk(
      "n5",
      "demoImage",
      {
        id: "n5",
        title: "未命名图片",
        kind: "image",
        status: "empty",
        gradient: GRAD.slate,
        emptySquare: true,
      },
      { x: 160, y: 130 },
    ),
  ];
}

const seedEdges: Edge[] = [
  { id: "e1", source: "n1", target: "n3" },
  { id: "e2", source: "n2", target: "n3" },
];

/* ---------- handlers 类型 ---------- */
type Handlers = {
  wrap: (id: string) => Pick<DemoNodeData, "onAction" | "onDuplicate" | "onVariant" | "onDelete">;
  duplicate: (id: string) => void;
  variant: (id: string) => void;
  remove: (id: string) => void;
  action: (id: string, name: string) => void;
};

let uid = 100;
const nextId = () => `n${++uid}`;

export default function XyqDemoPage() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

function Canvas() {
  /* 稳定回调引用：节点 data 里持有的函数不随渲染重建（需先于 nodes 初始化） */
  const handlersRef = useRef<Handlers>(null as unknown as Handlers);
  if (!handlersRef.current) {
    handlersRef.current = {
      wrap: (id: string) => ({
        onAction: (name: string) => handlersRef.current.action(id, name),
        onDuplicate: () => handlersRef.current.duplicate(id),
        onVariant: () => handlersRef.current.variant(id),
        onDelete: () => handlersRef.current.remove(id),
      }),
      duplicate: (id: string) => handlersRef.current.duplicate(id),
      variant: (id: string) => handlersRef.current.variant(id),
      remove: (id: string) => handlersRef.current.remove(id),
      action: (id: string, name: string) => handlersRef.current.action(id, name),
    };
  }

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DemoNodeData>>(
    seedNodes(handlersRef.current),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(seedEdges);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const [zoomPct, setZoomPct] = useState(100);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  /* 选中卡的提示词（按节点 id 存） */
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* ⌘C 剪贴板（存节点快照，⌘V 时重建） */
  const clipboardRef = useRef<DemoNodeData[]>([]);

  /* 撤销/重做：快照栈（data 含函数回调，用 JSON 序列化剥离；恢复时重挂） */
  type Snap = { nodes: Node<DemoNodeData>[]; edges: Edge[] };
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const [histVer, setHistVer] = useState(0); // 触发按钮刷新
  const cloneSnap = (): Snap => JSON.parse(
    JSON.stringify({ nodes, edges }),
    (key, value) => (typeof value === "function" ? undefined : value),
  );
  const reattach = (ns: Node<DemoNodeData>[]): Node<DemoNodeData>[] =>
    ns.map((n) => ({ ...n, data: { ...n.data, ...handlersRef.current.wrap(n.id) } }));
  const snapshot = () => {
    past.current.push(cloneSnap());
    if (past.current.length > 50) past.current.shift();
    future.current = [];
    setHistVer((v) => v + 1);
  };
  const undo = () => {
    const s = past.current.pop();
    if (!s) return;
    future.current.push(cloneSnap());
    setNodes(reattach(s.nodes));
    setEdges(s.edges);
    setHistVer((v) => v + 1);
    triggerSave();
    showToast("已撤销");
  };
  const redo = () => {
    const s = future.current.pop();
    if (!s) return;
    past.current.push(cloneSnap());
    setNodes(reattach(s.nodes));
    setEdges(s.edges);
    setHistVer((v) => v + 1);
    triggerSave();
    showToast("已重做");
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const triggerSave = useCallback(() => {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaved(true), 900);
  }, []);

  /* 节点操作 */
  const addNode = useCallback(
    (kind: CreateKind, label: string, gradient: string) => {
      snapshot();
      const id = nextId();
      const center = screenToFlowPosition({
        x: window.innerWidth / 2 - 140 + (uid % 5) * 36 - 60,
        y: window.innerHeight / 2 + (uid % 4) * 28 - 160,
      });
      const type = kind === "video" ? "demoVideo" : kind === "text" ? "demoText" : "demoImage";
      const data: DemoNodeData = {
        id,
        title: `${label} · 未命名 ${uid - 100}`,
        kind,
        status: "generating",
        gradient,
        typeLabel: `未命名${kind === "video" ? "视频" : kind === "text" ? "文本" : "图片"}`,
      };
      setNodes((ns) => [...ns, { id, type, position: center, data: { ...data, ...handlersRef.current.wrap(id) } }]);
      triggerSave();
      showToast(`已创建「${label}」节点`);
      // 模拟生成完成
      setTimeout(() => {
        setNodes((ns) =>
          ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, status: "done" } } : n)),
        );
        triggerSave();
      }, 2200);
    },
    [screenToFlowPosition, setNodes, triggerSave, showToast, snapshot],
  );

  const duplicate = useCallback(
    (srcId: string) => {
      snapshot();
      const id = nextId();
      setNodes((ns) => {
        const src = ns.find((n) => n.id === srcId);
        if (!src) return ns;
        return [
          ...ns,
          {
            ...src,
            id,
            position: { x: src.position.x + 32, y: src.position.y + 32 },
            selected: false,
            data: { ...src.data, id, title: src.data.title + " 副本" },
          },
        ];
      });
      triggerSave();
      showToast("已复制节点");
    },
    [setNodes, triggerSave, showToast, snapshot],
  );

  /* 生成 / 变体共用：置 generating → 换渐变 done */
  const runGeneration = useCallback(
    (id: string, toastStart: string, toastDone: string) => {
      snapshot();
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, status: "generating" as const } } : n,
        ),
      );
      showToast(toastStart);
      setTimeout(() => {
        setNodes((ns) =>
          ns.map((n) => {
            if (n.id !== id) return n;
            const palettes = Object.values(GRAD);
            const next = palettes[Math.floor(Math.random() * palettes.length)];
            return {
              ...n,
              data: {
                ...n.data,
                status: "done" as const,
                gradient: next,
                ...(n.data.status === "empty" ? { title: n.data.title, emptySquare: false } : {}),
              },
            };
          }),
        );
        triggerSave();
        showToast(toastDone);
      }, 2200);
    },
    [setNodes, showToast, triggerSave, snapshot],
  );

  const variant = useCallback(
    (id: string) => runGeneration(id, "正在生成变体…", "变体已生成"),
    [runGeneration],
  );

  const remove = useCallback(
    (id: string) => {
      snapshot();
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      triggerSave();
      showToast("已删除节点");
    },
    [setNodes, setEdges, triggerSave, showToast, snapshot],
  );

  const action = useCallback(
    (id: string, name: string) => {
      if (name === "上传" || name === "资产库") {
        runGeneration(id, `正在从${name}导入素材…`, "素材已导入");
        return;
      }
      showToast(`演示：${name}`);
    },
    [showToast, runGeneration],
  );

  /* 把最新的实现同步进稳定引用（每渲染更新，回调始终命中最新闭包） */
  handlersRef.current.duplicate = duplicate;
  handlersRef.current.variant = variant;
  handlersRef.current.remove = remove;
  handlersRef.current.action = action;

  /* ---------- 选中节点（三件套联动） ---------- */
  const selectedNode = nodes.find((n) => n.selected) as Node<DemoNodeData> | undefined;
  const selectedData = selectedNode?.data;
  const generating = selectedData?.status === "generating";

  /* ---------- 键盘快捷键（§4：⌘Z / ⇧⌘Z / ⌘C / ⌘V；编辑器聚焦时不拦截） ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement || t.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "c") {
        const sel = nodes.filter((n) => n.selected);
        if (sel.length) {
          clipboardRef.current = JSON.parse(
            JSON.stringify(sel.map((n) => n.data)),
            (k, v) => (typeof v === "function" ? undefined : v),
          );
          showToast("已复制节点");
        }
      } else if (mod && e.key.toLowerCase() === "v") {
        if (!clipboardRef.current.length) return;
        e.preventDefault();
        snapshot();
        const base = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const created: Node<DemoNodeData>[] = clipboardRef.current.map((d, i) => {
          const id = nextId();
          return {
            id,
            type:
              d.kind === "video" ? "demoVideo" : d.kind === "text" ? "demoText" : "demoImage",
            position: { x: base.x + i * 36, y: base.y + i * 36 },
            data: { ...d, id, title: d.title + " 副本", ...handlersRef.current.wrap(id) },
          };
        });
        setNodes((ns) => [...ns, ...created]);
        triggerSave();
        showToast("已粘贴节点");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, undo, redo, screenToFlowPosition, setNodes, triggerSave, showToast, snapshot]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f2f2f2] font-sans antialiased">
      {/* 画布区 */}
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          className="xyq-canvas"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(c: Connection) => {
            snapshot();
            setEdges((es) => addEdge(c, es));
            triggerSave();
            showToast("已建立连线");
          }}
          onNodeDragStart={() => snapshot()}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY });
          }}
          onMove={(_, vp) => setZoomPct(Math.round(vp.zoom * 100))}
          nodeTypes={demoNodeTypes}
          deleteKeyCode={["Delete", "Backspace"]}
          multiSelectionKeyCode={["Shift", "Meta"]}
          fitView
          fitViewOptions={{ padding: 0.35 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={40}
            size={2}
            color="#c1c1c1"
            bgColor="#f2f2f2"
          />
        </ReactFlow>

        <TopBar saved={saved} />
        <LeftRail onCreate={addNode} />

        {/* 底部：无选中 → 工具条；选中卡 → 提示词 composer（三件套联动） */}
        {selectedData ? (
          <SelectionComposer
            kind={selectedData.kind}
            prompt={prompts[selectedData.id] ?? ""}
            onPromptChange={(v) =>
              setPrompts((p) => ({ ...p, [selectedData.id]: v }))
            }
            onGenerate={() => runGeneration(selectedData.id, "正在生成…", "生成完成")}
            generating={!!generating}
          />
        ) : (
          <BottomBar
            zoom={zoomPct}
            canUndo={past.current.length > 0}
            canRedo={future.current.length > 0}
            onUndo={undo}
            onRedo={redo}
            onFit={() => fitView({ padding: 0.35, duration: 300 })}
            onZoomIn={() => zoomIn({ duration: 200 })}
            onZoomOut={() => zoomOut({ duration: 200 })}
          />
        )}

        {/* 画布空白右键菜单 */}
        {ctxMenu && (
          <NodeContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
            onUpload={() => {
              setCtxMenu(null);
              showToast("演示：打开上传");
            }}
            onAddNode={() => {
              setCtxMenu(null);
              addNode("image", "图片", GRAD.slate);
            }}
            onPaste={() => setCtxMenu(null)}
            onUndo={() => {
              setCtxMenu(null);
              undo();
            }}
            onRedo={() => {
              setCtxMenu(null);
              redo();
            }}
            canUndo={past.current.length > 0}
            canRedo={future.current.length > 0}
          />
        )}

        {toast && (
          <div
            className={`xyq-toast pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-[12px] text-white backdrop-blur-sm ${
              selectedData ? "bottom-[150px]" : "bottom-14"
            }`}
          >
            {toast}
          </div>
        )}

        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="absolute top-3 right-3 z-20 flex h-8 items-center gap-1.5 rounded-full border border-white bg-white/80 px-3 text-[13px] text-black shadow-sm backdrop-blur-xl transition-colors hover:bg-white"
          >
            💬 打开助手
          </button>
        )}
      </div>

      {/* 右侧 AI 面板 */}
      {panelOpen && <AiPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
