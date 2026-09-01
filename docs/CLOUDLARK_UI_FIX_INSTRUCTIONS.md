# AI Comic Pro 界面改造 - 功能修复补充指令

**给 Claude 的任务书**（配合 docs/CLOUDLARK_UI_DESIGN.md 与 docs/CLOUDLARK_UI_IMPLEMENTATION.md）

## 背景：当前状态与问题

上轮重构已把 page.tsx 改为 5 区布局（视觉完成，build/tsc/66 测试过），但**存在功能缺失**：

1. **🔴 剧本分析入口被删除**——`ScriptPanel` 无任何引用，用户无法输入剧本/分析资产（这是 AI Comic Pro 的核心起点）
2. **🔴 资产定妆室/分镜视图丢失**——`PreviewPanel` 变成死代码，`currentView` 的 assets/storyboard 视图没有 UI 入口
3. **🔴 底部创作栏纯 UI**——提示词 textarea 无 value/onChange 绑定、参数按钮无 onClick、**生成按钮（↑✦+260）点了没反应**
4. **🟡 底部操作栏纯 UI**——撤销/重做/缩放无绑定
5. **🟡 7 个死组件**——`TopToolbar/SideToolbar/BottomCommandBar/BottomActionBar/AddNodePanel/CardToolbar/ParamPopover` 建了但没被引用（布局直接写在 page.tsx）
6. **🟡 全部未提交**（git 最新 a94af0b）

---

## 修复要求（按顺序执行）

### 任务 1：恢复剧本分析入口（最高优先）

**目标**：用户能从新界面进入"剧本分析 → 资产提取"流程。

**方案（推荐 A）**：
- 左侧垂直工具栏加「📝 剧本」按钮
- 点击 → 画布右侧弹出 ScriptPanel **抽屉**（可关闭）
- 复用现有 `ScriptPanel` 组件（`components/ScriptPanel.tsx`）和它的 props：`onAnalyzeRequest` / `onGenerateStoryboard` / `onReset` / `onPlan4DirectorOutline`（从 `useWorkspace` 的 `handleAnalyze` / `handleGenerateStoryboard` 等传入，这些状态层完整，只需接 UI）

**验收**：点「📝 剧本」→ 抽屉打开 → 粘贴剧本 → 点分析 → 资产结果出现（画布或资产视图）。

### 任务 2：恢复资产/分镜视图

- `useWorkspace.currentView` 仍支持 `"assets" | "storyboard" | "plan4" | "voice"`（93 行）
- 在顶部工具栏或左侧加**视图切换**（如：画布 / 资产定妆室 / 分镜画廊）
- 恢复 `PreviewPanel` 的渲染（它负责 assets 定妆室 + storyboard 分镜画廊，现在只是没被引用）
- **验收**：切换视图能看到资产卡片（可上传参考图/生图/润色描述）和分镜画廊（可生成/重生成分镜图）

### 任务 3：底部创作栏接真实功能（核心）

**3a. 提示词输入框受控**
- textarea 绑定 `useState`（value/onChange），placeholder 保留"描述你想要生成的画面内容，@引用素材"

**3b. 参数按钮接浮层**
- 风格 / 画幅 / 分辨率 / 时长 / 参考模式 / 运镜 每个按钮点击 → 打开 `ParamPopover` 浮层（滑条/下拉）→ 选择后回填显示
- 值联动 `useWorkspace` 的 `currentStyle` / `storyboardAspectRatio` / `videoApiKey` 等现有状态

**3c. 生成按钮接真实链路**
```
点「↑ ✦+260」→
  if 画布有选中节点（video 类型）→ handleVideoNodeGenerate（AutoDL 视频链路）
  else if 有选中节点（asset/panel）→ handleNodeGenerate（生图链路）
  else → 提示"请先选中画布节点，或在画布上添加节点"
```
- 复用 `Plan4Canvas` 现有的 `onGenerate`（986 行调用处）与 `handleVideoNodeGenerate` / `handleNodeGenerate`
- 生成结果回填到节点（现有逻辑已处理），命令栏显示生成中状态

**3d. @ 引用素材**
- 输入 `@` → 弹出画布节点/资产选择列表（选中节点、资产图）
- 选中后引用其 `imageUrl` / `referenceImage` → 并入生成请求的 `referenceImages`（现有请求已支持）

**验收**：输入提示词 + 选参数 + 点生成 → 真正触发 AutoDL/生图，结果回到节点。

### 任务 4：清理死组件

- 检查 `TopToolbar/SideToolbar/BottomCommandBar/BottomActionBar/AddNodePanel/CardToolbar/ParamPopover` 是否被引用：
  - 若布局已在 page.tsx 直接实现 → **删除这些未使用文件**（不要留死代码）
  - 若任务 3 用到 ParamPopover → 保留并接线
- **保留**：`StyleLibrary`（已接线）、`PromptPolishButton`（已接线，VideoNode 润色）
- **验收**：`grep -rln "TopToolbar\|BottomCommandBar..." components app` 无业务引用（或全部真接线）；build 过

### 任务 5：提交

- 全部改动提交，**排除** `.env.local`、密钥类文件
- 提交信息：`feat: cloudlark-style canvas layout with restored core workflow`

---

## 验收（全部）

- `npm run build` / `npm run test:run`（66+）/ `npx tsc --noEmit` 全过
- **完整流程可用**：剧本分析 → 资产定妆 → 分镜生成 → 画布编辑 → 视频生成
- 底部创作栏生成按钮能触发真实生成
- 无死组件
- 改动已提交（git log 可见新提交）

## 红线（不可违反）

- **不动**：AutoDL 生成链路（`lib/video-gen.ts` 的 `generateVideoAutoDL`、`/api/generate-video` 请求结构）
- **不动**：提示词润色链路（`lib/prompt-skills/*` 10 模板、`app/api/expand-prompt`）
- **不动**：持久化逻辑（`lib/storage.ts`、`useWorkspace` 的 localStorage/IndexedDB 持久化）
- **保留**：React Flow 拖拽/连线/右键/`onNodesDelete` 图片清理
- 每完成一个任务跑一次 `tsc + test + build` 确认无回归
