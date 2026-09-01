# AI Comic Pro 界面改造 - 技术实现文档

配套 `docs/CLOUDLARK_UI_DESIGN.md`（设计稿）。本文档给 Claude 落地执行：数据模型、组件清单、现有代码复用、分阶段实施。

---

## 一、数据模型（新增/扩展）

### 1. 节点通用状态字段（所有节点 data 扩展）
```ts
interface NodeGenState {
  genStatus?: "empty" | "ready" | "generating" | "success" | "error"; // 待补充/待生成/生成中/成功/失败
  genError?: string;          // 失败原因（如"请选择背景 3次"）
  genCount?: number;          // 已生成张数（多图变体）
  referenceImages?: string[]; // 该节点的素材引用（图/视频，供 @ 引用和生成参考）
}
```
- 现有 `generateStatus`（生图用）与 `genStatus`（节点级）可合并或共存，避免改坏现有逻辑
- 持久化：`genStatus/genError/genCount` 走 plan4Canvas 持久化（现有剥离逻辑注意保留 genError 等轻量字段，只剥离 imageUrl/referenceImage 大图）

### 2. 底部创作栏状态
```ts
interface CommandBarState {
  prompt: string;
  refs: string[];       // @ 引用的节点 id / 素材 id
  style: string;        // 复用 currentStyle
  engine: string;       // 复用 videoEngine/imageEngine
  aspectRatio: string;  // 16:9 / 9:16 / 1:1 / 3:4
  resolution: string;   // 480p/720p/1080p（视频）/ 生图分辨率
  duration: number;     // 视频 5/10/15
  referenceMode: "none" | "image" | "multi" | "full";
  cameraMove: boolean;  // 运镜开关
  cost: number;         // 本次生成消耗估算（✨+260 那种）
}
```

### 3. 批量选择状态
```ts
const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]); // 多选
// 画布空白点击清空；框选/Shift 多选
```

---

## 二、组件清单（新增文件）

| 文件 | 职责 | 关键 props |
|---|---|---|
| `components/CanvasCommandBar.tsx` | 底部创作栏：提示词 + 参数行 + 生成按钮 + @引用 | prompt/refs/params 全量受控 + onGenerate + onRefsChange |
| `components/AddNodePanel.tsx` | 添加节点悬浮面板（角色/场景/3D/文本/图片/视频/音频 + 添加资源） | open/onAdd(type)/onClose/position |
| `components/ParamPopover.tsx` | 参数调节浮层（时长滑条/比例/分辨率下拉） | open/type(value)/onChange/onClose |
| `components/ReferencePanel.tsx` | 图生视频参考区（大卡片上传/用户库） | refs/onRefsChange |
| `components/CardToolbar.tsx` | 卡片选中/悬浮工具条（全选/复制/图像分离/裁剪/缩放/更多） | nodeId/onAction |
| `components/BatchActionBar.tsx` | 多选批量操作条（抽帧/提高画质/裁取/裁剪/翻转/智能成片/旋转） | selectedIds/onAction |
| `components/TopBar.tsx` | 顶部工具栏（项目名/风格/画幅/积分/分享） | 复用现有配置 state |

## 三、现有代码复用映射（不重造轮子）

| 新组件/功能 | 复用现有 |
|---|---|
| 生成按钮 → 生成链路 | `handleVideoNodeGenerate`（视频）、`handleNodeGenerate`（生图）、`handleBatchGenerateImages`（批量） |
| 风格下拉 | `lib/style-config.ts` 的 16 种画风 |
| 分辨率/时长 | `lib/video-options.ts` 的 `seedanceVideoResolutions/Ratios/Durations` |
| 引擎选择 | `lib/video-gen.ts` 的 `VIDEO_ENGINE_KIND_MAP` / `isVideoKindSupported` |
| 画布/连线/右键 | 现有 React Flow 配置（nodeTypes/edgeTypes/contextMenu/onNodesDelete 清理） |
| 卡片内容区 | AssetNode/PanelNode/VideoNode 现有实现（统一外层视觉即可） |
| 参考图存储 | `panelReferenceImages` / `assetReferenceImages`（IndexedDB，已持久化） |
| 提示词润色 | `app/api/expand-prompt`（已完整，VideoNode 重写后需把润色按钮接回） |

## 四、分阶段实施计划（每步可独立验收）

### Step 1：布局骨架（不动功能）
- 改 page.tsx 为 5 区布局：TopBar + 左工具栏 + 画布 + CommandBar 占位 + 底部操作栏
- 现有 ScriptPanel 配置收敛进 TopBar 的抽屉/设置入口
- 验收：布局正确，现有功能无回归（生成/画布/润色仍可用）

### Step 2：节点卡片统一视觉
- 统一 AssetNode/PanelNode/VideoNode 外层：标题 + 内容区 + 上传/资产库 + 状态标签 + 切换箭头
- 节点 data 加 genStatus 驱动状态色
- 验收：卡片统一，状态标签显示正确

### Step 3：底部创作栏 + @ 引用
- CanvasCommandBar：提示词输入 + 参数行（点开 ParamPopover）+ 生成按钮（触发现有生成链路）
- @ 引用：输入 @ 弹素材选择，引用选中/画布节点素材
- 验收：提示词 + 参数 + 生成全链路可用；@ 引用生效

### Step 4：添加节点面板 + 悬浮工具条
- AddNodePanel（点 + 或空白处弹出）
- CardToolbar（选中卡片顶部：全选/复制/裁剪/缩放/更多）
- BatchActionBar（多选批量，映射现有能力）
- 验收：加节点/卡片操作/批量全可用

### Step 5：润色功能接回 + 收尾
- VideoNode 润色按钮 + 悬浮编辑框重新接上（后端 expand-prompt 完整，按新布局适配）
- 生成消耗显示（✨+260 估算，可先静态值）
- 全量回归：66 测试 + build + 手动过一遍生成流程

**红线全程**：不动 AutoDL 生成链路 / prompt-skills 润色链路 / 持久化逻辑；每步 tsc + test + build 通过。

## 五、接口变更（最小化）

- 新增：`@ 引用素材` → 前端收集 refs → 并入现有生成请求体的 `referenceImages`（已支持）
- 新增：批量操作 → 复用现有 `handleBatchGenerateImages` 与视频/图片 API，不新增后端接口
- 生成消耗：前端估算（按引擎/时长/分辨率查价表，可先写死），不涉及后端
- **不改**：`/api/generate-video`、`/api/generate-image`、`/api/expand-prompt` 请求结构
