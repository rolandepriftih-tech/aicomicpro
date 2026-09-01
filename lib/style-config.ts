/**
 * 全局画风配置中心
 * 所有画风定义、前缀、支持的画幅比例统一在此管理
 */

export interface StyleConfig {
  /** 画风唯一标识 */
  value: string;
  /** 中文显示名 */
  label: string;
  /** 英文显示名 */
  labelEn: string;
  /** 生图提示词前缀（英文，用于图像生成API） */
  imagePrefix: string;
  /** 分析提示词前缀（中文，用于LLM分析资产时约束描述风格） */
  analysisPrefix: string;
  /** 支持的画幅比例 */
  aspectSupport: string[];
  /** 图标/颜色标识（用于UI展示） */
  color: string;
  /** 分类标签 */
  category: "anime" | "realistic" | "artistic" | "game" | "retro";
}

export const STYLE_CONFIGS: Record<string, StyleConfig> = {
  none: {
    value: "none",
    label: "不指定",
    labelEn: "No preset",
    imagePrefix: "",
    analysisPrefix: "",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#71717A",
    category: "artistic",
  },
  anime: {
    value: "anime",
    label: "日系动漫",
    labelEn: "Anime",
    imagePrefix:
      "anime style, clean lineart, vibrant colors, soft cel-shading, highly detailed design, studio ghibli inspired,",
    analysisPrefix:
      "日系动漫风格：清新线稿、明亮色彩、大眼睛表情、柔和赛璐珞阴影、精致角色设计。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#FF6B9D",
    category: "anime",
  },
  guoman: {
    value: "guoman",
    label: "国漫",
    labelEn: "Chinese Anime",
    imagePrefix:
      "Chinese anime style (guoman), modern Chinese 3D animated series aesthetic, volumetric 3D rendering with realistic sculptural forms, physically accurate shading and material thickness, cinematic chiaroscuro lighting with strong dimensional depth, expressive design inspired by Ne Zha and Ling Cage, thick atmospheric haze and volumetric god rays, dynamic cinematic composition,",
    analysisPrefix:
      "国漫风格：现代国产3D动画美学、立体体积感渲染、雕塑般写实形体、物理准确的材质厚度与光影、受《哪吒》《灵笼》启发的电影级明暗对比、厚重大气体积感与体积光、动态电影构图。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#E74C3C",
    category: "anime",
  },
  gufeng: {
    value: "gufeng",
    label: "古风",
    labelEn: "GuFeng",
    imagePrefix:
      "ancient Chinese fantasy style (gufeng), elegant flowing hanfu robes, ethereal immortal aura, jade and silk details, wuxia and xianxia inspired, golden hair ornaments, cloud and dragon patterns, misty mountains background,",
    analysisPrefix:
      "古风风格：飘逸汉服、仙侠/武侠氛围、玉石丝绸细节、金色发饰、云龙纹样、仙气飘渺、武侠与仙侠元素。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#C0392B",
    category: "artistic",
  },
  realistic: {
    value: "realistic",
    label: "真人/写实",
    labelEn: "Realistic",
    imagePrefix:
      "photorealistic, hyper-detailed, cinematic lighting, skin pores visible, professional studio photography, 8K resolution, natural skin tones, lifelike textures,",
    analysisPrefix:
      "真人写实风格：照片级真实感、超精细细节、电影级打光、皮肤毛孔可见、专业摄影棚效果、8K分辨率、自然肤色。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#F39C12",
    category: "realistic",
  },
  cinematic: {
    value: "cinematic",
    label: "电影质感",
    labelEn: "Cinematic",
    imagePrefix:
      "cinematic film still, anamorphic lens, dramatic Rembrandt lighting, shallow depth of field, color-graded teal and orange, widescreen composition, film grain texture,",
    analysisPrefix:
      "电影质感风格：电影静帧画面、变形镜头、伦勃朗戏剧光、浅景深、青橙色调调色、宽屏构图、胶片颗粒纹理。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#9B59B6",
    category: "realistic",
  },
  shortdrama: {
    value: "shortdrama",
    label: "短剧风格",
    labelEn: "Short Drama",
    imagePrefix:
      "vertical short drama aesthetic, high saturation glamour, dramatic makeup, intense emotional expressions, mobile-optimized vertical framing, bright key lighting, trending social media style,",
    analysisPrefix:
      "短剧风格：高饱和 glamour、戏剧化妆容、强烈情绪表情、竖屏优化构图、明亮主光、社交媒体流行风格。",
    aspectSupport: ["9:16", "1:1", "3:4"],
    color: "#FF1744",
    category: "realistic",
  },
  cyberpunk: {
    value: "cyberpunk",
    label: "赛博朋克",
    labelEn: "Cyberpunk",
    imagePrefix:
      "cyberpunk neon cityscape, holographic displays, chrome cybernetics, rain-soaked reflective streets, high contrast neon pink and cyan, dystopian future, LED implants,",
    analysisPrefix:
      "赛博朋克风格：霓虹城市景观、全息显示、铬合金赛博格、雨水打湿的反光的街道、高对比霓虹粉青、反乌托邦未来、LED植入体。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#00E5FF",
    category: "artistic",
  },
  comic: {
    value: "comic",
    label: "美漫风格",
    labelEn: "Comic",
    imagePrefix:
      "American comic book style, bold black inking, strong chiaroscuro, dynamic action posing, halftone dot texture, vibrant primary colors, panel-ready composition,",
    analysisPrefix:
      "美漫风格：美式漫画粗黑线稿、强烈明暗对比、动态动作姿势、半调网点纹理、鲜艳原色、分镜就绪构图。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#3498DB",
    category: "anime",
  },
  hok_ying: {
    value: "hok_ying",
    label: "王者·云缨闪卡",
    labelEn: "HoK Holographic",
    imagePrefix:
      "Honor of Kings holographic trading card style, crystalline light refraction, dynamic action pose mid-combat, iridescent magical aura, ornate Chinese fantasy armor with dragon motifs, blazing spear energy effects, premium card foil texture with rainbow holo border, ultra-sharp details, character showcase card,",
    analysisPrefix:
      "王者荣耀云缨闪卡风格：全息闪卡质感、晶体光折射、战斗动态姿势、虹彩魔法光环、华丽中式幻想铠甲配龙纹、烈焰长枪能量特效、高级卡箔纹理配彩虹全息边框、超锐利细节、角色展示卡。",
    aspectSupport: ["9:16", "3:4", "1:1"],
    color: "#FFD700",
    category: "game",
  },
  pixel: {
    value: "pixel",
    label: "像素风",
    labelEn: "Pixel Art",
    imagePrefix:
      "16-bit pixel art, dithered shading, limited 16-color palette, retro SNES game aesthetic, crisp pixel edges, isometric or side-view, sprite sheet style,",
    analysisPrefix:
      "像素风格：16位像素艺术、抖动阴影、16色有限调色板、复古SNES游戏美学、锐利像素边缘、等距或侧视图、精灵图风格。",
    aspectSupport: ["1:1", "16:9", "4:3"],
    color: "#2ECC71",
    category: "retro",
  },
  ink: {
    value: "ink",
    label: "水墨国风",
    labelEn: "Ink Wash",
    imagePrefix:
      "traditional Chinese ink wash painting, xieyi freehand style, flowing expressive brushstrokes, rice paper texture with bleeding ink, poetic misty atmosphere, minimal color accents of cinnabar red,",
    analysisPrefix:
      "水墨国风风格：传统中国水墨画、写意自由笔法、流畅表现性笔触、宣纸纹理配晕染墨迹、诗意朦胧氛围、少量朱砂红点缀。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#5D6D7E",
    category: "artistic",
  },
  steampunk: {
    value: "steampunk",
    label: "蒸汽朋克",
    labelEn: "Steampunk",
    imagePrefix:
      "steampunk Victorian era, polished brass gears and cogs, leather straps with buckles, copper steam pipes, clockwork mechanisms, sepia tones with copper highlights, retro-futuristic,",
    analysisPrefix:
      "蒸汽朋克风格：维多利亚时代、抛光黄铜齿轮、皮带扣具、铜质蒸汽管道、发条机械装置、棕褐色调配铜色高光、复古未来主义。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#D35400",
    category: "artistic",
  },
  gothic: {
    value: "gothic",
    label: "哥特/暗黑",
    labelEn: "Gothic",
    imagePrefix:
      "gothic dark fantasy, intricate black lace and velvet, candlelight chiaroscuro, ornate baroque architecture, melancholic pale beauty, crimson rose accents, shadowy atmosphere,",
    analysisPrefix:
      "哥特暗黑风格：复杂黑色蕾丝和天鹅绒、烛光明暗对比、华丽巴洛克建筑、忧郁苍白之美、深红玫瑰点缀、暗影氛围。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#2C3E50",
    category: "artistic",
  },
  chibi: {
    value: "chibi",
    label: "卡通/Q版",
    labelEn: "Chibi",
    imagePrefix:
      "chibi cartoon style, oversized head 2:1 ratio, cute rounded proportions, soft pastel colors, rounded chubby shapes, adorable kawaii expression, toy-like figure,",
    analysisPrefix:
      "卡通Q版风格：头部比例2:1的Q版、可爱圆润比例、柔和粉彩色调、圆润胖乎乎造型、可爱kawaii表情、玩具般人偶。",
    aspectSupport: ["1:1", "9:16", "3:4"],
    color: "#FF9FF3",
    category: "anime",
  },
  oilpaint: {
    value: "oilpaint",
    label: "油画/古典",
    labelEn: "Oil Painting",
    imagePrefix:
      "oil painting on canvas, classical art style, visible expressive brushstrokes, rich impasto texture, Renaissance chiaroscuro lighting, museum-quality masterpiece,",
    analysisPrefix:
      "油画古典风格：油画布面、古典艺术风格、可见表现性笔触、浓厚肌理质感、文艺复兴明暗光法、博物馆级 masterpiece。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#E67E22",
    category: "artistic",
  },
  scifi: {
    value: "scifi",
    label: "科幻/未来",
    labelEn: "Sci-Fi",
    imagePrefix:
      "hard science fiction, sleek minimalist spacecraft interiors, holographic control interfaces, clean geometric design, advanced technology with glowing blue accents, sterile white and chrome environment,",
    analysisPrefix:
      "科幻未来风格：硬科幻、极简流线型飞船内部、全息控制界面、简洁几何设计、配蓝色发光点缀的先进科技、无菌白铬环境。",
    aspectSupport: ["16:9", "9:16", "1:1", "3:4", "4:3"],
    color: "#1ABC9C",
    category: "artistic",
  },
  retro: {
    value: "retro",
    label: "复古/昭和",
    labelEn: "Retro",
    imagePrefix:
      "1980s retro anime aesthetic, subtle CRT scanlines, pastel bubblegum color grading, VHS tape tracking texture, nostalgic summer atmosphere, city pop vibes,",
    analysisPrefix:
      "复古昭和风格：1980年代复古动画美学、微妙CRT扫描线、 pastel泡泡糖色调、VHS磁带跟踪纹理、怀旧夏日氛围、city pop氛围。",
    aspectSupport: ["16:9", "9:16", "1:1", "4:3"],
    color: "#FF69B4",
    category: "retro",
  },
};

/** 画风列表（用于遍历） */
export const STYLE_LIST = Object.values(STYLE_CONFIGS);

/** 画风value数组 */
export const STYLE_VALUES = Object.keys(STYLE_CONFIGS);

/** 判断画风是否支持某画幅 */
export function isAspectSupported(styleValue: string, aspect: string): boolean {
  const cfg = STYLE_CONFIGS[styleValue];
  if (!cfg) return true; // 未知画风默认全支持
  return cfg.aspectSupport.includes(aspect);
}

/** 获取某画风的生图前缀 */
export function getImagePrefix(styleValue: string): string {
  return STYLE_CONFIGS[styleValue]?.imagePrefix || "";
}

/** 获取某画风的分析前缀 */
export function getAnalysisPrefix(styleValue: string): string {
  return STYLE_CONFIGS[styleValue]?.analysisPrefix || "";
}

/** 获取某画风的配置 */
export function getStyleConfig(styleValue: string): StyleConfig | undefined {
  return STYLE_CONFIGS[styleValue];
}

/** 默认画风 */
export const DEFAULT_STYLE = "none";
