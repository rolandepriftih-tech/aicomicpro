# 小云雀卡片规格补充（CDP 实测采样 2026-08-27）

> 与 `CLOUDLARK_UI_SPECS.md` 配套。本文档全部数值来自运行中小云雀画布的 CDP 实测（computed style + MutationObserver 时间线），非估算。

---

## 1. 卡片状态机（核心机制：同一元素换 CSS 变量，无类名切换）

卡片元素 `.xyq-media-node-card` 内联样式（原样摘录）：

```
border-radius: 36px;
border: var(--xyq-canvas-node-card-selected-border,
            var(--xyq-canvas-node-card-border, 1px solid rgba(255,255,255,0.9)));
background: var(--xyq-canvas-node-card-hover-background,
            var(--xyq-canvas-node-card-bg, rgba(247,247,247,0.8)));
backdrop-filter: blur(40px);
transition: background-color 150ms ease-out, border-color 150ms ease-out;
box-shadow: none;
```

变量实测值（定义于 `.react-flow` 根作用域，body/html 只有默认值）：

| 状态 | 变量 | 值 |
|---|---|---|
| 默认描边 | `--xyq-canvas-node-card-border` | `1px solid #fff` |
| 选中描边 | `--xyq-canvas-node-card-selected-border` | `1px solid color-mix(in srgb,#0000001f 30%,#0000)` ≈ **rgba(0,0,0,0.037)** |
| 默认背景 | `--xyq-canvas-node-card-bg` | `#ffffff80` = rgba(255,255,255,**0.5**) |
| 悬停背景 | `--xyq-canvas-node-card-hover-background` | `#fffc` = rgba(255,255,255,**0.8**) |

**要点**：
- ❌ 没有紫色选中环。选中 = 描边从纯白 1px 变为极淡黑发丝线 rgba(0,0,0,0.037)，视觉上"描边加深"。
- ❌ 选中不改背景，悬停才改（0.5→0.8 白）。
- ❌ 卡面无投影；立体感全部来自磨砂 backdrop-blur(40px) + 半透明白。
- 切换动画仅 150ms ease-out，非常克制。
- React Flow 自身的 `.selected` 类**不出现**在节点 wrapper 上（自研选中状态管理）。

## 2. 卡片几何

| 类型 | 比例 | 实测尺寸（zoom≈100% / 77% / 51%） | DOM type |
|---|---|---|---|
| 图片 | 4:3（也有 1:1、9:16 变体） | 588×441 / 299×224 | `biz/image` |
| 视频 | 9:16 | 234×416 / 168×299 | `biz/video` |
| 场景(分镜) | 自适应内容 | 299×265 | `biz/scene` |

- 圆角 36px（卡面）；空态图标 44×44；上传/资产库按钮 83×24 r32 12px/500 黑，图标 12×12。
- 连接 handle：视觉 34px 磨砂圆（bg rgba(255,255,255,0.5) + 1px #fff + blur(6px) + 17px 图标），命中区放大到 **67×67** 透明圆（易点击）。
- 选中前卡上方有 `nodrag nopan` 16px 高条带（handle 区）。
- 平移画布时 `.react-flow__pane` 追加 `dragging` 类（cursor 变化）。

## 3. 选中 Chrome 三件套（同时出现/消失，MutationObserver 证实）

选中任一卡片时，以下三块**一起**挂载；点空白处**一起**卸载：

### 3.1 悬浮工具条 `.selectionToolbar`
- 定位：节点上方居中，`translate(-50%, calc(-100% - 28px))`——距卡顶 **28px**。
- 外层：`z-index:20`，radius 8px。
- Surface：bg rgba(255,255,255,0.8) + blur(6px)，radius **32px**，
  shadow：`inset 0 0 0 1px #fff, 0 12px 24px rgba(0,0,0,0.04)`。
- 按钮：h32 / radius 999px / 12px / 可用色 rgb(0,0,0)、禁用色 **rgba(0,0,0,0.2)**；"更多"为 32×32 纯图标钮。
- 空卡（无素材）时全部能力按钮禁用，只有"更多"可用。
- 按钮清单（实测）：
  - **视频卡**：抽帧 · 提升画质 · 截取 · 音频分离 · 裁剪 · 解析 · 智能抠像 · 片段重拍(带"限免"角标) · 打光 · 旋转 · 更多
  - **图片卡**：720°全景图 · 超分 · 图层分离 · 裁剪 · 旋转 · 更多

### 3.2 提示词编辑器（tiptap）
- 类名 `tiptap ProseMirror xyq-canvas-rich-prompt-editor editor-* editorEmpty-*`，973×94。
- 空态类 `editorEmpty`；随选中卡出现，位置在画布底部创作栏区域（即底部栏变成"选中卡的提示词输入"）。

### 3.3 参数面板 + 生成按钮（选中视频卡时实测）
- 参数条 1040×196：`风格 2.0 Fast` `VIP` `480P` `10s` `全参考运镜` `Seed` `可选预设提示词`。
- 生成按钮 35×35 圆形；旁挂积分标签 `xyq-generation-credit-cost__original-label` 显示 **"50"**。
- 图片卡时 composer 显示 `Seedream 5.0 Pro`、比例 `9:16 · 1K`、`限免`。

## 4. 右键菜单 `.nodeContextMenu`

- 220×256，画布空白处右键弹出。
- 项：**上传 / 添加节点 / 粘贴 ⌘V / 撤销 ⌘Z / 重做 Shift+⌘Z**（带快捷键右列）。

## 5. 添加节点弹层 `.addNodePopover`

- 300×456，从左侧栏 + 按钮展开。
- 组：**角色**（副标"全剧新角色、已有角色新形象"，子标签类 `addNodeSubLabel`）· **场景** · **3D 导演台**（New 角标）· **文本** · **图片** · **视频**（副标"片段、参考运镜"）· **音频**。

## 6. 卡片 attached-label（卡下方标题区，截图目测 + 类名佐证）

- `data-xyq-node-layout="attached-label"`：标题行「未命名标题 + 橙色小 tag + ⋯」13px 黑；下行「出版链接 暂无」12px 灰。
- 卡上方另有 12px 灰「未命名图片/未命名视频」类型小字。

## 7. 顶栏补充（前文档遗漏）

- 画布名「未命名画布」13px/400 黑 + 「已保存」状态胶囊：12px/500 **rgb(17,159,53)** 绿字 + 9px 圆点 svg，radius 40px。

## 8. 交互行为时间线（真实用户操作实录）

1. 单击卡片 → selectionToolbar + tiptap 编辑器 + 参数面板同时挂载（无过渡类，直接出现）。
2. 单击空白 → 三件套同时卸载；pane 拖拽平移时 class 追加 `dragging`。
3. 右键空白 → nodeContextMenu 挂载；Esc → 卸载。
4. 右键/再次点击卡片 → 重新选中，三件套重现。
5. 反自动化：canvas-sdk 对 pointerdown 调 preventDefault+stopPropagation，自研手势状态机管理选中/拖拽 —— **自动化测试请直接测自家实现，不必复刻其事件架构**。

## 9. 复刻到 ai-comic-pro 的映射（task #3 施工单）

| 小云雀 | plan4-canvas 现有组件 | 改造 |
|---|---|---|
| 卡面状态机 | `AssetNode/PanelNode/VideoNode` 卡体 | 统一为一套 CSS 变量三态（默认/hover/selected），150ms 过渡，白描边→淡黑发丝线 |
| selectionToolbar | `CardToolbar` | 上方 28px 居中、r32 磨砂胶囊、inset 白描边+0 12px 24px 4% 阴影、按钮 h32 禁用 20% 黑 |
| 三件套联动 | `DetailPanel` 常驻右侧 | 改为选中才出现：工具条+提示词输入+参数条一体 |
| attached-label | 卡下标题区 | 未命名标题+tag+元信息行 |
| 右键菜单 | （无） | 新增 5 项菜单 |
| 添加节点弹层 | `LeftRail` 面板 | 补副标题文案与 New 角标 |
