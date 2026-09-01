# 小云雀画布 UI 精确实测规格（2026-08-27 实测）

> **数据来源**：通过 Chrome CDP 直接打开线上页面（xyq.jianying.com 项目编辑器），从 DOM
> computed style 和 1200 个 CSS 设计变量中提取的**真实值**，非目测。
> 本文档修正 `CLOUDLARK_UI_DESIGN.md`（录屏分析版）中的推测规格，冲突处以本文档为准。
>
> 配图见 `docs/ui-ref/`：整体布局 `jianying-editor.png`、顶栏 `xyq-topbar.png`、
> 左浮层 `xyq-leftrail.png`、底部工具条 `xyq-bottombar.png`、AI 面板 `xyq-aipanel.png`。

---

## 0. 两个决定性发现

1. **小云雀画布底层就是 React Flow**（DOM 含 `react-flow light` / `react-flow__pane` /
   `react-flow__renderer`，点阵用 `react-flow__background` 的 SVG pattern 渲染）。
   我们项目用 `@xyflow/react` 是同一个库 → **样式可以近乎 1:1 复刻**，无需换引擎。
2. **线上是浅色主题，不是深色**。录屏分析版假设的"深色底"与线上产品相反：
   页面白底、画布浅灰、卡片半透明白 + 毛玻璃。品牌紫为 `#aa80ff`（l3）/ `#8149f2`（accent）。

---

## 1. 布局骨架（实测坐标，视口 1680×1050）

| 区域 | 实测位置/尺寸 | 说明 |
|---|---|---|
| 顶栏 | 全宽，**高 48px**，透明底（透出画布灰） | 控件均为悬浮胶囊，不铺底色 |
| 左侧浮层 rail | x=16 起，**宽 56px，高 200px**，垂直居中 | 毛玻璃白色竖条 |
| 节点类型卡（点+展开） | 卡 **172×64px**，间距 10px，横向排列 | 位于"+"右侧 |
| 画布 | x=0~1180（AI 面板占右侧 500px） | React Flow，点阵背景 |
| 右侧 AI 面板 | **宽 498px（≈500）**，y=48 至底，白底 | 与顶栏同层，非悬浮卡片 |
| 底部工具条 | 左下角 x=12，y=1010，**高 28px** | 悬浮胶囊组 |

顶栏高 48px、AI 面板宽 500px 是两个最硬的锚点数字。

---

## 2. 设计 Token（从官方 CSS 变量提取）

### 2.1 颜色

```css
/* 品牌紫 */
--color-brand:        #aa80ff;   /* 主品牌，fill-brand-l3 */
--xyq-canvas-accent:  #8149f2;   /* 强调紫（选中、连线高亮、info） */
--fill-brand-l1:      #e0d2fc;   /* 紫 soft 底 */
--fill-brand-l2:      #ccb2ff;   /* 紫 mid */
--gradient-primary:   linear-gradient(135deg, #e0d2fc, #aa80ff);

/* 中性（关键：文字用纯黑+透明度分层，不是灰阶色值） */
--text-primary:      #000;        /* 主文字 */
--text-secondary:    #0009;       /* rgba(0,0,0,.6) */
--text-tertiary:     #0006;       /* rgba(0,0,0,.4) */
--text-placeholder:  #0000004d;   /* rgba(0,0,0,.3) */

/* 表面 */
--canvas-surface:    #f2f2f2;     /* 画布底色（--xyq-canvas-wash 同值） */
workspace:           #e6e6e6;     /* 画布外围 workspace 实测 rgb(230,230,230) */
--color-surface:     #fff;        /* 面板/卡片 */
--background-bg-input: #f6f6f6;   /* 输入类控件底 */

/* 边框 */
--canvas-border:        #00000014;  /* rgba(0,0,0,.08) —— 通用边框 */
--canvas-border-strong: #0000001f;  /* rgba(0,0,0,.12) */

/* 交互面（hover 系列，全部基于 #484849 透明度） */
--canvas-surface-muted:  #4848490a;  /* 卡片底/hover 一档 rgba(72,72,73,.04) */
--canvas-controls-hover: #48484914;  /* hover 二档 rgba(72,72,73,.08) */

/* 语义 */
--xyq-canvas-success: #52992e;   /* "已保存"绿 */
--xyq-canvas-error:   #f64e4b;
--text-warning:       #f49336;
--xyq-canvas-edge-line:          #00000014;  /* 连线默认色 */
--xyq-canvas-edge-line-selected: #aa80ff;    /* 连线选中色 */
```

### 2.2 字体与字号

- 字族：`"Albert Sans", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif`
  （中文环境下实际渲染以苹方/微软雅黑为主；我们直接用 system-ui 栈即可，视觉差异极小）
- 字号阶梯（typography 变量）：caption-xs **10px** / caption-s **11px** / caption-m **12px** /
  label-m **13px** / body-m **14px**（正文默认）/ body-l **16px**
- 行高 1.4～1.5；**标题字重仅 500**，正文 400 —— 整体偏"轻"，没有 700+ 的粗字

### 2.3 圆角

```css
--border-radius-sm: 0.375rem;  /* 6px  小控件 */
--border-radius-md: 0.5rem;    /* 8px  输入框内元素 */
--border-radius-lg: 0.75rem;   /* 12px 图标方块 */
--radius-lg:        1rem;      /* 16px 卡片/面板/输入框外框 */
按钮全圆角: 32px（icon 按钮）/ 38~42px（胶囊）——直接用 rounded-full
```

### 2.4 阴影与毛玻璃（剪映质感的来源，重点）

```css
/* 画布卡片 */
--shadow-card-canvas: 0 8px 40px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.04);
/* 悬浮面板（生成面板/浮层） */
--canvas-generation-compact-shadow: 0 12px 32px rgba(16,16,16,.12), 0 2px 6px rgba(16,16,16,.06);
/* 浮动元素（节点拖起） */
--xyq-canvas-shadow-floating: 0 10px 15px -5px rgba(0,0,0,.05);

/* 毛玻璃胶囊统一套路（顶栏按钮组/左 rail/底部工具条全用它） */
background: rgba(255,255,255,.8);
border: 1px solid #fff;
backdrop-filter: blur(20px~24px);
box-shadow: 0 8px 24px rgba(0,0,0,.04);
```

---

## 3. 逐组件实测规格

### 3.1 顶栏（48px，见 xyq-topbar.png）

- **无整体底色**：透明浮在画布上，控件各自成白色胶囊 → 深浅主题切换成本低
- 画布名区：`未命名画布` 14px/400 + `已保存` 绿色 #52992e，整体在 32px 高胶囊内
- 风格库按钮：高 36px，圆角 42px，`pad 0 12px 0 8px`，图标+文字+chevron gap 4px
- 比例按钮（9:16）：高 32px 胶囊，`rgba(255,255,255,.5)` + blur(24px)，
  `inset 0 0 0 1px #fff` + `0 2px 20px rgba(0,0,0,.02)`（白描边内阴影是质感关键）
- 积分组（✦60 | 开会员）：白 0.8 + blur(24px) + 1px #fff 边，高 32px，内部 gap 12px；
  积分数字带紫色 ✦ 图标，"开会员"仅 11px/500
- 分享/文档/头像：裸图标按钮，无底色

### 3.2 左侧浮层 rail（56×200px，见 xyq-leftrail.png）

- 容器：`rgba(255,255,255,.8)` + blur(20px)，圆角 **52px**（全圆长条），1px #fff 边，
  `0 8px 24px rgba(0,0,0,.04)`，`pad 11px 1px`，图标间 gap 8px
- **"+"主按钮**：36×36px **纯黑圆形**，白色 + 图标；
  阴影 `inset 0 0 12px rgba(255,255,255,.5), 0 2px 3px rgba(0,0,0,.08), 0 6px 10px rgba(0,0,0,.08)`；
  右上角 New 徽章：紫 `#aa80ff` 白字，胶囊
- 其余小图标按钮：36×36px，圆角 32px，透明底，hover 时 `#48484914`

### 3.3 节点类型卡（点+展开，172×64px）

```
background: rgba(72,72,73,.04);      /* #4848490a 内凹浅灰 */
border: 1px solid rgba(0,0,0,.08);
border-radius: 16px;
box-shadow: inset 0 1px 0 rgba(0,0,0,.04);   /* 顶部内凹细线 */
padding: 0 14px;  gap 10px;  卡间距 10px;
图标容器: 40×40px 左右、圆角 12px、底色 rgba(72,72,73,.06)、内为线性图标
文字: 14px/400 纯黑
```
横向排开（角色/场景/3D导演台/视频/图片/文本，音频换行），超过约 6 个换行。

### 3.4 画布（React Flow）

- 背景 `#f2f2f2`（注意：不是 #e6e6e6，那是最外层 workspace；React Flow 容器盖在上面）
- **点阵背景**（react-flow `<Background variant="dots">` 实测 SVG pattern）：
  **间距 39.2px（≈40px），圆点半径 1.05px（≈2px 直径）**，颜色为浅灰（约 #c1c1c1）
  → 直接 `<Background gap={40} size={2} color="#c1c1c1" />`
- 连线：默认 `1px solid rgba(0,0,0,.08)`，选中 `#aa80ff`；连线宽约 1.5px
- 节点卡片：`--xyq-canvas-node-card-bg: #ffffff80`（半透明白）+ 1px #fff 边 + 卡片阴影，
  拖起时 `drop-shadow(0 12px 28px rgba(144,89,255,.16))`（紫色淡影）

### 3.5 底部工具条（28px 高，见 xyq-bottombar.png）

- 外层胶囊：圆角 32px，blur(12px)，内部分组 `gap 2px`
- 图标按钮：28×28px，`pad 7px`（图标 14px），透明底；**激活态 = 白色实底圆形**
  （截图中"磁吸"按钮为白底凸起）
- 缩放胶囊：独立一组，`rgba(255,255,255,.8)` + 1px #fff 边，内容 `− 100% +`，
  数字 11px/600，加减号 16px
- 位置：画布左下角，距边 12px

### 3.6 右侧 AI 助手面板（宽 500px，见 xyq-aipanel.png）

- 白底实色（#fff），与顶栏平层衔接（顶栏在其上方 48px 内结束）
- 空态：垂直水平居中 `Hi, {用户名}` + 副标题，均 16px/500，纯黑
- **输入框**（底部悬浮，距边 16px）：
  ```
  白底、圆角 16px、pad 16px、宽 450px（面板内 16px 边距）、高约 132px
  ring: 0 0 0 1px rgba(0,0,0,.08)
  shadow: 0 10px 15px -5px rgba(0,0,0,.05), 0 4px 6px -2px rgba(0,0,0,.05)
  富文本输入 14px，placeholder rgba(0,0,0,.3)
  ```
- 输入框底部工具行：`+`、图片▾、图表▾、`技能`、`720P·2K▾` + 右侧圆形发送按钮；
  小按钮 30px 高、圆角 full、12px/500、色 `rgba(0,0,0,.6)`
- 底部免责声明：11px，`rgba(0,0,0,.4)`，居中

---

## 4. 与当前实现的差异清单（改造 backlog）

| # | 现状 | 目标（剪映实测） | 涉及文件 |
|---|---|---|---|
| 1 | 全局深色 `#000` | 浅色：画布 `#f2f2f2` / 面板 `#fff` | `globals.css` |
| 2 | 品牌紫 `#7c3aed` | `#aa80ff`（主）/ `#8149f2`（强调） | `globals.css` |
| 3 | 文字灰阶 `#a1a1aa` 等 | 纯黑 + alpha 分层（`#0009/#0006/#0000004d`） | `globals.css` |
| 4 | 顶栏铺深色底 | 透明顶栏 + 各控件独立白色毛玻璃胶囊 | `TopToolbar.tsx` |
| 5 | 左 rail 直角/深色 | 56px 白毛玻璃圆条 + 黑色"+"主按钮 | `SideToolbar.tsx` |
| 6 | 画布深色网格 | `<Background gap={40} size={2} color="#c1c1c1" />` + `#f2f2f2` | `Plan4Canvas.tsx` |
| 7 | 连线自定义色 | 默认 `#00000014`，选中 `#aa80ff` | `CustomEdge.tsx` |
| 8 | 节点卡深色 | 半透明白卡 `#ffffff80` + 1px #fff 边 + `shadow-card-canvas` | `*Node.tsx` |
| 9 | 底部命令栏深色 | 28px 毛玻璃胶囊组 + 白底激活态 | `BottomActionBar.tsx` / `CanvasToolbar.tsx` |
| 10 | 右侧创作助手深色 | 白底面板 + 悬浮圆角 16px 输入框（ring 1px 黑 8%） | `Plan4Workbench.tsx` |

> 建议落地顺序：先换 Token（1–3，全局立竿见影）→ 画布与连线（6–8）→ 顶栏/浮层（4–5）
> → 底部与右面板（9–10）。全程不动生成链路与数据逻辑。

---

## 5. 可直接粘贴的 Token 块（浅色主题）

```css
:root {
  /* brand */
  --brand-primary: #aa80ff;
  --brand-accent: #8149f2;
  --brand-soft: #e0d2fc;
  --gradient-brand: linear-gradient(135deg, #e0d2fc, #aa80ff);
  /* surface */
  --background: #ffffff;
  --canvas-surface: #f2f2f2;
  --surface-muted: rgba(72, 72, 73, 0.04);   /* 卡片底/hover 一档 */
  --surface-hover: rgba(72, 72, 73, 0.08);
  /* text（纯黑 + alpha） */
  --foreground: #000000;
  --text-secondary: rgba(0, 0, 0, 0.6);
  --text-muted: rgba(0, 0, 0, 0.4);
  --text-placeholder: rgba(0, 0, 0, 0.3);
  /* border */
  --border-default: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  /* status */
  --status-success: #52992e;
  --status-error: #f64e4b;
  --status-warning: #f49336;
  /* 阴影 */
  --shadow-card: 0 8px 40px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
  --shadow-float: 0 12px 32px rgba(16, 16, 16, 0.12), 0 2px 6px rgba(16, 16, 16, 0.06);
  --shadow-node-drag: 0 12px 28px rgba(144, 89, 255, 0.16);
  /* 毛玻璃胶囊 */
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: #ffffff;
  --glass-blur: 20px;
  /* 布局锚点 */
  --header-height: 48px;          /* 不变 */
  --ai-panel-width: 500px;        /* 新增 */
  --canvas-dots-gap: 40px;
}
```
