# 生图模式集成指南

## ✅ 完成功能

### 1. 核心组件

#### GenerationModePanel.tsx
- **位置**: `components/plan4-canvas/GenerationModePanel.tsx`
- **功能**:
  - 4种生图模式选择
  - 自动生成分镜提示词
  - 参考图上传管理
  - 一键生成图片/视频

#### GenerationModeSelector.tsx
- **位置**: `components/plan4-canvas/generation-modes/GenerationModeSelector.tsx`
- **功能**:
  - 可视化模式选择UI
  - 显示每种模式的说明
  - 标记需要参考图的模式

### 2. 模板系统

#### StoryboardPromptBuilder
- **位置**: `lib/prompt-builders/storyboard-prompt-builder.ts`
- **功能**:
  - 根据生图模式匹配对应模板
  - 构建完整的提示词
  - 支持批量生成

#### storyboard-template.ts
- **位置**: `lib/templates/storyboard-template.ts`
- **包含**:
  - 分镜图模板 (GPT Image 2)
  - 场景预制作参考板 (6模块)
  - 资产设计表 (角色/场景/道具)
  - Seedance视频提示词

### 3. 4种生图模式

| 模式 | 用途 | 输出 | 模板 |
|:---|:---|:---:|:---|
| **GPT Image 2 分镜图** | 生成专业电影分镜图 | 图片 | 6模块视觉参考板 |
| **Seedance 文生视频** | 纯文本生成AI视频 | 视频 | 导演描述/运镜/动作 |
| **Seedance 图生视频** | 上传参考图生成视频 | 视频 | 参考图+文字描述 |
| **资产设计表** | 角色/场景/道具设计 | 图片 | 三视图/表情/材质 |

## 🎯 使用方式

### 1. 在分镜节点中打开生图模式

```typescript
// 点击分镜节点的"生图模式"按钮
<button onClick={() => d.onOpenGenerationMode?.(id)}>
  生图模式
</button>
```

### 2. 选择生图模式

- 弹出模式选择面板
- 显示4种生图模式卡片
- 每个卡片显示：图标、名称、描述、是否需要参考图

### 3. 自动生成提示词

- 选择模式后，自动生成对应模板的提示词
- 显示在预览区域
- 可复制提示词

### 4. 上传参考图（如果需要）

- 图生视频模式需要参考图
- 支持上传多张图片
- 可删除已上传的图片

### 5. 一键生成

- 点击生成按钮
- 根据模式调用对应的API
- 生成图片或视频

## 📦 代码示例

### 使用 StoryboardPromptBuilder

```typescript
import { StoryboardPromptBuilder } from '@/lib/prompt-builders';

const builder = new StoryboardPromptBuilder(panel, context);
const result = builder.build('gpt-image2-storyboard');

console.log(result.prompt);      // 生成的提示词
console.log(result.mode);        // gpt-image2-storyboard
console.log(result.aspectRatio); // 16:9
```

### 批量生成提示词

```typescript
import { batchGeneratePromptsForPanels } from '@/lib/templates';

const results = await batchGeneratePromptsForPanels({
  panels: scriptPanels,
  mode: 'seedance-text-to-video',
  context: { characters, location, artStyle },
  onProgress: (i, total) => console.log(`${i}/${total}`)
});
```

## 🔧 集成检查清单

- [x] GenerationModePanel.tsx 组件创建
- [x] GenerationModeSelector.tsx 组件创建
- [x] StoryboardPromptBuilder 集成
- [x] PanelNode 更新（添加生图模式按钮）
- [x] Plan4Canvas 更新（添加面板状态管理）
- [x] TypeScript 类型定义
- [x] 构建通过

## 📚 文件结构

```
components/plan4-canvas/
├── GenerationModePanel.tsx        # 生图模式面板
├── generation-modes/
│   ├── GenerationModeSelector.tsx # 模式选择器
│   └── index.ts                   # 统一导出
└── ...

lib/
├── templates/
│   ├── storyboard-template.ts     # 模板引擎
│   └── index.ts                   # 统一导出
└── prompt-builders/
    ├── storyboard-prompt-builder.ts # 提示词构建器
    └── index.ts                     # 统一导出
```

---

**状态**: ✅ 已完成集成
