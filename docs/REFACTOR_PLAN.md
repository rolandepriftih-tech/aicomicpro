# 重构计划：大组件拆分

## 📋 目标

将三个超大组件拆分为更小、更易维护的子组件，同时保持现有功能完整。

## 🎯 待拆组件清单

| 组件 | 当前行数 | 优先级 | 复杂度 |
|------|----------|--------|--------|
| `app/page.tsx` | 1446 行 | P0 | 高 |
| `components/PreviewPanel.tsx` | 1568 行 | P0 | 高 |
| `components/plan4-canvas/Plan4Canvas.tsx` | 2148 行 | P1 | 极高 |

---

## 📝 拆分方案

### 1. `app/page.tsx` (1446 行)

#### 现状分析
- 包含主页面布局、状态管理、API 调用逻辑
- 有 50+ 个 useState，状态管理混乱
- `enrichAssets` 逻辑重复
- 混合了 UI 渲染和业务逻辑

#### 拆分方案

```
app/
├── page.tsx                    # 主页面（精简版，~300行）
├── page/
│   ├── WorkspaceLayout.tsx     # 工作台布局组件
│   ├── WorkspaceHeader.tsx     # 顶部工具栏
│   └── useWorkspace.ts         # 工作台状态 Hook
```

#### 子组件职责

| 组件 | 职责 | 行数预估 |
|------|------|----------|
| `page.tsx` | 主入口，组合子组件 | ~300 |
| `WorkspaceLayout.tsx` | 左右分栏布局 | ~100 |
| `WorkspaceHeader.tsx` | 顶部工具栏（模型选择、设置） | ~150 |
| `useWorkspace.ts` | 状态管理、API 调用 | ~400 |

#### 拆分步骤

1. **提取 `useWorkspace.ts` Hook**
   - 移动所有 useState 到 Hook
   - 封装 API 调用逻辑
   - 验证：`npm run build && npm run test:run`

2. **提取 `WorkspaceLayout.tsx`**
   - 移动布局相关 JSX
   - 验证：`npm run build && npm run test:run`

3. **提取 `WorkspaceHeader.tsx`**
   - 移动顶部工具栏
   - 验证：`npm run build && npm run test:run`

4. **精简 `page.tsx`**
   - 组合子组件
   - 验证：`npm run build && npm run test:run`

---

### 2. `components/PreviewPanel.tsx` (1568 行)

#### 现状分析
- 包含资产列表、分镜画廊、导演笔记等多个功能区
- 大量条件渲染和列表渲染
- 复杂的事件处理逻辑

#### 拆分方案

```
components/
├── PreviewPanel.tsx            # 主预览面板（精简版，~200行）
├── preview/
│   ├── AssetSection.tsx        # 资产展示区
│   ├── AssetCard.tsx           # 资产卡片
│   ├── StoryboardSection.tsx   # 分镜画廊区
│   ├── StoryboardCard.tsx      # 分镜卡片
│   ├── DirectorNotes.tsx       # 导演笔记
│   └── usePreviewPanel.ts      # 预览面板状态 Hook
```

#### 子组件职责

| 组件 | 职责 | 行数预估 |
|------|------|----------|
| `PreviewPanel.tsx` | 主入口，组合子组件 | ~200 |
| `AssetSection.tsx` | 资产分类展示 | ~300 |
| `AssetCard.tsx` | 单个资产卡片 | ~200 |
| `StoryboardSection.tsx` | 分镜列表展示 | ~300 |
| `StoryboardCard.tsx` | 单个分镜卡片 | ~250 |
| `DirectorNotes.tsx` | 导演笔记展示 | ~100 |
| `usePreviewPanel.ts` | 状态管理 | ~200 |

#### 拆分步骤

1. **提取 `usePreviewPanel.ts` Hook**
   - 移动状态和事件处理
   - 验证：`npm run build && npm run test:run`

2. **提取 `AssetCard.tsx`**
   - 移动资产卡片渲染
   - 验证：`npm run build && npm run test:run`

3. **提取 `AssetSection.tsx`**
   - 移动资产分类展示
   - 验证：`npm run build && npm run test:run`

4. **提取 `StoryboardCard.tsx`**
   - 移动分镜卡片渲染
   - 验证：`npm run build && npm run test:run`

5. **提取 `StoryboardSection.tsx`**
   - 移动分镜列表展示
   - 验证：`npm run build && npm run test:run`

6. **提取 `DirectorNotes.tsx`**
   - 移动导演笔记
   - 验证：`npm run build && npm run test:run`

7. **精简 `PreviewPanel.tsx`**
   - 组合子组件
   - 验证：`npm run build && npm run test:run`

---

### 3. `components/plan4-canvas/Plan4Canvas.tsx` (2148 行)

#### 现状分析
- React Flow 画布核心组件
- 包含节点管理、边管理、工具栏、对话框等
- 复杂的画布交互逻辑
- 多个嵌套的对话框组件

#### 拆分方案

```
components/plan4-canvas/
├── Plan4Canvas.tsx             # 主画布组件（精简版，~400行）
├── Plan4CanvasManager.tsx      # 画布管理器（节点/边操作）
├── Plan4Toolbar.tsx            # 画布工具栏
├── Plan4Dialogs.tsx            # 对话框集合
├── useCanvasState.ts           # 画布状态 Hook
├── useCanvasActions.ts         # 画布操作 Hook
└── nodes/                      # 节点组件（已存在）
    ├── AssetNode.tsx
    ├── PanelNode.tsx
    └── StyleNode.tsx
```

#### 子组件职责

| 组件 | 职责 | 行数预估 |
|------|------|----------|
| `Plan4Canvas.tsx` | 主入口，ReactFlow 容器 | ~400 |
| `Plan4CanvasManager.tsx` | 节点/边 CRUD 操作 | ~500 |
| `Plan4Toolbar.tsx` | 顶部工具栏 | ~200 |
| `Plan4Dialogs.tsx` | 所有对话框 | ~300 |
| `useCanvasState.ts` | 画布状态管理 | ~300 |
| `useCanvasActions.ts` | 画布操作逻辑 | ~400 |

#### 拆分步骤

1. **提取 `useCanvasState.ts` Hook**
   - 移动画布状态
   - 验证：`npm run build && npm run test:run`

2. **提取 `useCanvasActions.ts` Hook**
   - 移动画布操作
   - 验证：`npm run build && npm run test:run`

3. **提取 `Plan4Toolbar.tsx`**
   - 移动工具栏
   - 验证：`npm run build && npm run test:run`

4. **提取 `Plan4Dialogs.tsx`**
   - 移动对话框
   - 验证：`npm run build && npm run test:run`

5. **提取 `Plan4CanvasManager.tsx`**
   - 移动节点/边管理
   - 验证：`npm run build && npm run test:run`

6. **精简 `Plan4Canvas.tsx`**
   - 组合子组件
   - 验证：`npm run build && npm run test:run`

---

## ⚠️ 不做的事项

### 不改动
1. **React Flow 核心逻辑** - 保持节点/边的数据结构不变
2. **API 接口** - 不修改任何后端 API
3. **类型定义** - 不修改 `types/` 目录下的类型
4. **画布功能** - 不添加新功能，只重构现有代码

### 不删除
1. **现有组件** - 保持所有现有组件的导出
2. **工具函数** - 保持 `lib/` 目录下的工具函数
3. **测试文件** - 保持所有测试文件

### 不影响
1. **用户体验** - 重构后界面和交互保持一致
2. **性能** - 重构后性能不应下降
3. **测试覆盖** - 重构后测试必须全部通过

---

## ✅ 验收标准

### 每步验收
```bash
# 1. 类型检查
npx tsc --noEmit

# 2. 代码规范
npm run lint

# 3. 测试通过
npm run test:run

# 4. 构建成功
npm run build

# 5. 功能验证
npm run dev
# 手动测试核心功能
```

### 最终验收
- [ ] 所有组件行数 < 500 行
- [ ] TypeScript 类型检查通过
- [ ] ESLint 无 error
- [ ] 所有测试通过
- [ ] 构建成功
- [ ] 功能完整

---

## 📅 时间估算

| 阶段 | 工作量 | 预计时间 |
|------|--------|----------|
| 拆分 `page.tsx` | 4 步 | 2-3 小时 |
| 拆分 `PreviewPanel.tsx` | 7 步 | 3-4 小时 |
| 拆分 `Plan4Canvas.tsx` | 6 步 | 4-5 小时 |
| 测试和验证 | - | 1-2 小时 |
| **总计** | 17 步 | **10-14 小时** |

---

## 📚 参考资源

- [React 组件拆分最佳实践](https://react.dev/learn/thinking-in-react)
- [自定义 Hook 模式](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React Flow 文档](https://reactflow.dev/)

---

**创建时间**: 2026-08-24
**最后更新**: 2026-08-24
**状态**: 待执行
