<img width="1574" height="1063" alt="截屏2026-09-01 16 06 19" src="https://github.com/user-attachments/assets/fc0c2698-92b2-4768-9770-7d1c7bc695b8" />![Uploading 截屏2026![Uploading 截屏2026-09-01 14.49.26.png…]()
<img width="1574" height="1063" alt="截屏2026-09-01 14 49 33" src="https://github.com/user-attachments/assets/bbb6adfc-f1f3-406a-b0b7-9e459eec39a4" />
<img width="1574" height="1063" alt="截屏2026-09-01 14 49 19" src="https://github.com/user-attachments/assets/b0d74167-f566-49f2-9425-f87ca03a83b8" />
<img width="1574" height="1063" alt="截屏2026-09-01 14 49 21" src="https://github.com/user-attachments/assets/c6b2d6ac-8b8a-438f-9b20-4d985fb4d3cc" />
<img width="1574" height="1063" alt="截屏2026-09-01 14 49 26" src="https://github.com/user-attachments/assets/3149fa00-8aba-4f32-8b65-72cb075dda7a" />
<img width="1574" height="1063" alt="截屏2026-09-01 14 49 33" src="https://github.com/user-attachments/assets/33bd43a2-1686-4c0d-a7bf-7621ccde4e0f" />
-09-01 16.06.19.png…]()
# AI Comic Pro

本地 AI 漫剧制片工作台 - 从剧本到分镜到视频的一站式创作工具。

## ✨ 功能特性

### 📝 剧本分析与资产提取
- 智能分析剧本，自动提取角色、场景、道具、生物、座舱等资产
- 支持多模态分析（文本 + 参考图）
- 生成详细的资产定妆描述

### 🎨 资产生图
- 支持 16 种画风：日系动漫、国漫、古风、真人写实、电影质感等
- Gemini Imagen / OpenAI 兼容接口
- 资产参考图上传与一致性管理
- AI 辅助优化资产描述

### 🎬 分镜生成
- **方案一**：忠实原著 - 逐句拆解，绝不删减
- **方案二**：爆款编导 - 网感美化，强化钩子与悬念
- **方案三**：连贯强化 - 专攻单场戏，动作细腻连贯
- **方案四**：导演画布 - React Flow 可视化编辑

### 🎥 视频生成
- **Seedance**：字节跳动视频生成模型
- **MiniMax H3**：字字动画视频模型
- 支持文生视频、图生视频、首尾帧、多参考图、对口型等模式

### 🎤 语音合成
- **MiMo TTS**：小米语音合成模型
- 多种音色和风格可选
- 支持分镜台词自动生成

### 🖼️ 可视化画布
- React Flow 节点式编辑
- 资产节点、分镜节点、风格节点
- AI 画布助手分析与建议
- 实时预览与编辑

## 🚀 快速开始

### 环境要求
- Node.js 20+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 配置 API Key

创建 `.env.local` 文件：

```env
# 文本模型（Gemini 或 OpenAI）
GEMINI_API_KEY=your_gemini_key
# 或
OPENAI_API_KEY=your_openai_key

# 图像模型
IMAGE_API_KEY=your_image_key

# 视频模型（可选）
ARK_VIDEO_API_KEY=your_ark_key
ZZDH_API_KEY=your_zzdh_key

# 语音模型（可选）
MIMO_API_KEY=your_mimo_key
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 📁 项目结构

```
ai-comic-pro/
├── app/                    # Next.js 页面和 API 路由
│   ├── api/               # 后端 API
│   │   ├── analyze/       # 剧本分析
│   │   ├── generate-image/ # 图像生成
│   │   ├── generate-video/ # 视频生成
│   │   ├── generate-storyboard/ # 分镜生成
│   │   ├── generate-voice/ # 语音合成
│   │   └── plan4/         # 方案四导演画布
│   ├── page.tsx           # 主页面
│   └── layout.tsx         # 布局
├── components/            # React 组件
│   ├── ScriptPanel.tsx    # 剧本面板
│   ├── PreviewPanel.tsx   # 预览面板
│   ├── VoicePanel.tsx     # 语音面板
│   └── plan4-canvas/     # 方案四画布组件
├── lib/                   # 核心库
│   ├── llm.ts            # LLM 调用封装
│   ├── image-gen.ts      # 图像生成
│   ├── video-gen.ts      # 视频生成
│   ├── tts.ts            # 语音合成
│   ├── storage.ts        # IndexedDB 存储
│   ├── style-config.ts   # 画风配置
│   ├── skills/           # 技能系统
│   └── templates/        # 模板系统
├── types/                 # TypeScript 类型定义
├── tests/                 # 测试文件
└── docs/                  # 文档
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行测试并查看覆盖率
npm run test:coverage
```

## 🛠️ 开发

### 代码规范

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint -- --fix
```

### 构建生产版本

```bash
npm run build
npm start
```

## 🎯 支持的模型

### 文本模型
- Gemini 2.5 Pro
- GPT-4o / GPT-4o-mini
- 其他 OpenAI 兼容模型

### 图像模型
- Gemini Imagen
- DALL-E 3
- 其他 OpenAI 兼容模型

### 视频模型
- Seedance (字节跳动)
- MiniMax H3 (字字动画)

### 语音模型
- MiMo TTS (小米)

## 📝 更新日志

### v0.1.0 (2026-08-24)
- ✨ 基线快照：lint/type/test 全部通过
- 🎨 支持 16 种画风
- 🎬 支持 4 种分镜方案
- 🎥 支持 Seedance 和 MiniMax 视频生成
- 🎤 支持 MiMo TTS 语音合成
- 🖼️ React Flow 可视化画布
- 🧪 完整的测试覆盖（30 个测试用例）
