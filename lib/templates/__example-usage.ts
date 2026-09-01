/**
 * 完整工作流程使用示例
 *
 * 演示如何将剧本内容→分镜→选择生图模式→生成提示词的完整流程
 */

import { StoryboardPromptBuilder, PromptBuilderContext } from "@/lib/prompt-builders/storyboard-prompt-builder";
import { StoryboardPanel, GenerationMode } from "@/lib/templates/storyboard-template";

// ============================================
// 示例1: 从剧本获取分镜数据
// ============================================

/**
 * 假设从剧本解析得到的分镜数据
 * 实际项目中这些数据来自 plan4Result 或 storyboardResult
 */
const examplePanels: StoryboardPanel[] = [
  {
    panelId: 1,
    storyBeat: "主角从阴影中走出，眼神坚定地望向远方",
    englishImagePrompt: "A determined protagonist emerges from shadows, looking into the distance with resolute eyes",
    chineseDirectorNotes: "开场镜头，营造神秘感，低机位仰拍增强主角气势",
    cinematography: {
      shotType: "MS",
      focalLength: 35,
      cameraHeight: "low",
      depthOfField: "medium",
      composition: "rule_of_thirds",
      cameraMovement: "push",
      actionRhythm: "slow_压迫",
      directorStyle: "villeneuve",
      lighting: {
        keyLight: "side_back",
        colorTemperature: "cool",
        mood: "low_key",
      },
      materialKeywords: ["weathered leather", "polished steel"],
    },
    firstFrame: {
      characterPosition: "画面左侧，部分在阴影中",
      characterPosture: "站立，身体微侧",
      characterOrientation: "面向右方",
      characterExpression: "眼神坚定",
    },
    lastFrame: {
      characterPosition: "画面中央偏左",
      characterPosture: "站立，正面朝向",
      characterOrientation: "正视前方",
      characterExpression: "眼神更加坚定",
    },
    characters: ["主角"],
    location: "废弃工厂",
    props: ["手枪", "风衣"],
  },
  {
    panelId: 2,
    storyBeat: "反派从黑暗中现身，两人对峙",
    englishImagePrompt: "The antagonist emerges from darkness, facing the protagonist in a tense standoff",
    chineseDirectorNotes: "对切镜头，强调对峙的紧张感，使用浅景深突出人物",
    cinematography: {
      shotType: "MCU",
      focalLength: 85,
      cameraHeight: "eye",
      depthOfField: "shallow",
      composition: "center",
      cameraMovement: "static",
      actionRhythm: "slow_压迫",
      directorStyle: "nolan",
      lighting: {
        keyLight: "top",
        colorTemperature: "contrast",
        mood: "chiaroscuro",
      },
    },
    firstFrame: {
      characterPosition: "画面右侧",
      characterPosture: "站立，正面朝向",
      characterOrientation: "面向左方",
      characterExpression: "冷笑",
    },
    lastFrame: {
      characterPosition: "画面中央偏右",
      characterPosture: "站立，身体微前倾",
      characterOrientation: "正视前方",
      characterExpression: "威胁性的微笑",
    },
    characters: ["反派"],
    location: "废弃工厂",
    props: ["手枪"],
  },
];

// ============================================
// 示例2: 构建上下文
// ============================================

const exampleContext: PromptBuilderContext = {
  characters: [
    {
      name: "主角",
      appearance: "亚洲男性，短发，坚毅的面容，深邃的眼神",
      outfit: "黑色风衣，深色牛仔裤，战术靴",
      referenceImage: "https://example.com/protagonist-ref.jpg",
    },
    {
      name: "反派",
      appearance: "欧洲男性，金发，锐利的眼神，自信的微笑",
      outfit: "定制西装，昂贵手表",
    },
  ],
  location: {
    name: "废弃工厂",
    description: "废弃的工业建筑，锈迹斑斑的金属结构，破碎的窗户，昏暗的灯光透过缝隙照进来",
    referenceImage: "https://example.com/factory-ref.jpg",
  },
  props: [
    { name: "手枪", description: "黑色手枪，军用级" },
    { name: "风衣", description: "黑色皮质风衣， worn look" },
  ],
  artStyle: "赛博朋克 + 电影感 + 高对比度 + cinematic lighting",
  referenceImages: [
    "https://example.com/ref1.jpg",
    "https://example.com/ref2.jpg",
  ],
};

// ============================================
// 示例3: 使用Builder生成分镜提示词
// ============================================

export function exampleUsage() {
  console.log("=== 示例1: 生成分镜图提示词 (GPT Image 2) ===\n");

  // 为第一个分镜生成分镜图提示词
  const panel1Builder = new StoryboardPromptBuilder(
    examplePanels[0],
    exampleContext
  );
  const storyboardPrompt = panel1Builder.build("gpt-image2-storyboard");

  console.log("Mode:", storyboardPrompt.mode);
  console.log("Template:", storyboardPrompt.template);
  console.log("Requires Ref Images:", storyboardPrompt.requiresReferenceImages);
  console.log("Aspect Ratio:", storyboardPrompt.aspectRatio);
  console.log("\nGenerated Prompt:\n", storyboardPrompt.prompt);

  console.log("\n=== 示例2: 生成视频提示词 (Seedance) ===\n");

  // 为第二个分镜生成视频提示词
  const panel2Builder = new StoryboardPromptBuilder(
    examplePanels[1],
    exampleContext
  );
  const videoPrompt = panel2Builder.build("seedance-text-to-video");

  console.log("Mode:", videoPrompt.mode);
  console.log("Template:", videoPrompt.template);
  console.log("Duration:", videoPrompt.duration);
  console.log("Quality:", videoPrompt.quality);
  console.log("\nGenerated Prompt:\n", videoPrompt.prompt);

  console.log("\n=== 示例3: 批量生成 ===\n");

  // 批量为所有分镜生成提示词
  const batchResults = examplePanels.map((panel, index) => {
    const builder = new StoryboardPromptBuilder(panel, exampleContext);
    return builder.build("gpt-image2-storyboard");
  });

  batchResults.forEach((result, index) => {
    console.log(`Panel ${index + 1}: ${result.mode} | ${result.template}`);
  });

  return {
    storyboardPrompt,
    videoPrompt,
    batchResults,
  };
}

// ============================================
// 示例4: 实际使用场景
// ============================================

/**
 * 实际使用场景：用户从剧本获取分镜，选择生图模式，生成提示词
 */
export function realWorldExample() {
  // 步骤1: 从剧本获取分镜数据（假设从API获取）
  const panelsFromScript = examplePanels;

  // 步骤2: 用户选择生图模式
  const selectedMode: GenerationMode = "seedance-image-to-video";

  // 步骤3: 构建上下文
  const context: PromptBuilderContext = exampleContext;

  // 步骤4: 为每个分镜生成提示词
  const results = panelsFromScript.map((panel) => {
    const builder = new StoryboardPromptBuilder(panel, context);
    const result = builder.build(selectedMode);

    return {
      panelId: panel.panelId,
      storyBeat: panel.storyBeat,
      ...result,
    };
  });

  // 步骤5: 根据模式获取需要上传的参考图
  const needsRefImages = results.some((r) => r.requiresReferenceImages);
  const refImageTypes = results.flatMap((r) => r.referenceTypes);

  // 返回完整结果
  return {
    mode: selectedMode,
    panels: results,
    needsRefImages,
    refImageTypes: [...new Set(refImageTypes)],
    totalPrompts: results.length,
  };
}

// 运行示例
if (typeof window !== "undefined") {
  // 浏览器环境
  console.log("StoryboardPromptBuilder 已加载");
}
