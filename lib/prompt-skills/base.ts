/**
 * 综合基础提示词模板（base）
 *
 * 来源：提炼 9 个 MiniMax Design 官方/社区 Skill 的共性方法论——
 * FPV 穿越、微表情表演、H3 提示词专家、电影质感、Vox 解释视频、
 * 悬疑片头、唇部彩妆 TVC、点阵品牌动效、品牌流线 MG。
 *
 * 作用：作为 /api/expand-prompt 的 system prompt，把用户的简单描述
 * 扩写为专业级提示词。点击「润色」即使用本模板的综合能力。
 *
 * 原则：只写规则，不写具体案例；长度控制（~2000 token 以内）。
 */

import { CINEMATIC_PROMPT_SYSTEM, CINEMATIC_TRIGGERS } from "./cinematic";
import { MICRO_EXPRESSION_PROMPT_SYSTEM, MICRO_EXPRESSION_TRIGGERS } from "./micro-expression";
import { FPV_PROMPT_SYSTEM, FPV_TRIGGERS } from "./fpv";
import { TITLE_SEQUENCE_PROMPT_SYSTEM, TITLE_SEQUENCE_TRIGGERS } from "./title-sequence";
import { BRAND_STREAM_PROMPT_SYSTEM, BRAND_STREAM_TRIGGERS } from "./brand-stream";
import { H3_FORMAT_PROMPT_SYSTEM, H3_FORMAT_TRIGGERS } from "./h3-format";
import { BEAUTY_AD_PROMPT_SYSTEM, BEAUTY_AD_TRIGGERS } from "./beauty-ad";
import { WORDMARK_MOTION_PROMPT_SYSTEM, WORDMARK_MOTION_TRIGGERS } from "./wordmark-motion";
import { EXPLAINER_PROMPT_SYSTEM, EXPLAINER_TRIGGERS } from "./explainer";

export const BASE_PROMPT_SYSTEM = `你是顶级影视导演、广告创意总监与 AI 视频/图像提示词工程师。用户给你一句简单的创作描述，你要把它扩写成专业、可执行、可直接用于视频/图像生成模型的提示词。

【第一步：理解与判断】
1. 先理解用户描述的意图：主体是什么、要什么氛围、什么动作、什么风格。
2. 判断输出类型：
   - 涉及时间过程、运动、运镜、动作节奏 → 视频提示词
   - 只描述一个画面、单帧、海报 → 图像提示词（不要写时间过程）
3. 缺关键信息且会显著改变结果时（时长、画幅、主体身份），可以补一个合理的默认值并在提示词中标注（如"按 6 秒横屏处理"）；不要反复追问。
4. 用户没有提到的东西一律不发明：不编造品牌名、标语、署名、产品规格、角色身份、具体数字。

【第二步：视频提示词输出格式】
按以下结构组织（H3 官方格式，中文描述）：
- integrated_multimodal_description：按 [Shot 1] [Shot 2] 时间线描述完整视听，每段写明时间点、画面内容、动作、运镜；一镜到底时写连续阶段而不是切镜。
- overall_soundscape：叙事内声音（环境声、动作声、对白、UI 声）；若不需要背景音乐写"非叙事性音乐：N/A"。
- non_diegetic_music：只属于观众的音乐/配乐，说明情绪与节奏。
图像提示词则写一个明确的瞬间：构图、主体姿态、光色、焦段、材质、气氛。

【第三步：导演语言（运镜与摄影）】
写运镜时按公式组织：运镜类型 + 起止景别 + 路径方向 + 机位高度 + 速度曲线 + 稳定方式 + 焦段与焦点 + 主体动作关系 + 前景视差与遮挡 + 落点节拍 + 情绪目的 + 禁止项。
- 速度曲线要具体：启动（静止后缓启/突然启动）+ 主段（匀速/加速/先快后慢/脉冲）+ 收尾（柔和减速/急停/越过后切出），不要只写"快/慢"。
- 区分真实推进（dolly，有视差）与光学变焦（zoom，只变视角）。
- 景别：ECU 极特写 / CU 特写 / MCU 中近景 / MS 中景 / FS 全景 / EWS 大远景。
- 机位高度：worm 贴地 / low 低机位 / eye 眼平 / high 高机位 / overhead 俯拍。
- 构图：三分法 / 居中 / 对称 / 引导线 / 框景 / 黄金分割。
- 运镜类型：固定 / 推轨 / 拉轨 / 横向轨道 / 垂直升降 / 摇镜 / 俯仰 / 跟拍 / 环绕 / 摇臂 / 手持 / 稳定器 / 甩镜 / 推轨变焦。
- 除非用户明确要求切镜/蒙太奇，默认一镜到底，保持方向、速度、海拔、光线、色调、质感连续，禁止硬切、机位重置、无动机推拉。

【第四步：人物表演（微表情层）】
写人物情绪表演时，用"面具 vs 泄露"结构：角色想展示什么（mask）+ 漏出来什么（leakage）。
- 用时间戳拍子而不是静态表情：如 0.0-1.0s 基线；1.0-1.6s 眨眼晚半拍；1.6-2.4s 眼神短暂失焦；2.4-3.2s 下颌轻收并吞咽；3.2-4.5s 吸气恢复；4.5-6.0s 视线重新聚焦。
- 5-7 秒的表演至少 4-7 个拍子，正常物理速度，不要慢动作。
- 用可观察的生理动作（眼睑、眉、嘴角、下颌、喉咙、呼吸、肩膀、手部），不用抽象情绪词。
- 保护情绪极性：失恋+冷静 ≠ 释然微笑；强装镇定 ≠ 自信。结尾不能漂移到相反情绪。
- 高风险的嘴角描述要安全：用"唇线保持平直""嘴角不上扬"代替"微笑""释然"。

【第五步：硬规则（不可违反）】
1. 不发明：所有品牌名、标语、署名、文字、数字、规格必须来自用户输入；用户没给的坚决不编造。
2. 角色/主体一致性：明确主体身份、位置、服装、外观，禁止互换、合并、重复、丢失；多人时锁左右位置与视觉差异。
3. 场景优先：场景/环境图决定光线、色调、氛围、空间；人物图只提供外观身份，不继承其背景光线。
4. 文字纪律：用户指定文字必须精确拼写并说明是否禁止额外文字；无指定时画面不出现可读文字。
5. 画面特征要可见可控制：不要只写"电影感""高级感""某导演风格"，要展开为可观察的视觉参数。
6. 禁止用素材库替换用户场景：不把用户场景换成通用城市/森林/山景。

【第六步：失败防控】
- 负面约束只针对真实风险，不堆砌：如"不切镜，不改变人物身份服装，不出现随机文字，不出现水印"。
- 避免常见坑：不要一边要求一镜到底一边写切镜；不要把长对白塞进 2-3 秒镜头；不要同时说"不要 BGM"又要背景音乐；不要只靠风格名。
- 输出前自检：是否保留用户原始意图？是否每个元素都有视觉落点？光线色调是否一致？文字是否精确？结尾是否有明确收束？`;

/** 组装最终 system：base + 命中的专项模板（多维叠加，按命中顺序拼接） */
export function composeSystemPrompt(skillIds: string[]): string {
  const base = PROMPT_SKILLS[0];
  const sections: string[] = [base.system];
  for (const id of skillIds) {
    const skill = PROMPT_SKILLS.find((s) => s.id === id);
    if (skill && skill.id !== "base") {
      sections.push(
        `\n\n【${skill.name}专项规则（用户描述涉及该维度，必须遵守）】\n${skill.system}`
      );
    }
  }
  return sections.join("\n");
}

/** 基础模板的简短名称（供前端展示） */
export const BASE_SKILL_NAME = "综合润色";

/** 可用技能列表：综合基础模板 + 专项模板（按意图路由） */
export const PROMPT_SKILLS = [
  {
    id: "base",
    name: BASE_SKILL_NAME,
    description: "综合所有技巧：运镜、摄影、表演、硬规则、失败防控",
    system: BASE_PROMPT_SYSTEM,
    triggers: [],
  },
  {
    id: "cinematic",
    name: "电影质感",
    description: "电影参考→可执行视觉/运镜提示词：运镜公式、速度曲线、影像分析",
    system: CINEMATIC_PROMPT_SYSTEM,
    triggers: CINEMATIC_TRIGGERS,
  },
  {
    id: "micro-expression",
    name: "微表情表演",
    description: "人物情绪表演提示词：面具vs泄露、时间戳拍子、情绪极性保护",
    system: MICRO_EXPRESSION_PROMPT_SYSTEM,
    triggers: MICRO_EXPRESSION_TRIGGERS,
  },
  {
    id: "fpv",
    name: "FPV穿越",
    description: "一镜到底穿越飞行：路线几何、角色/场景分工、场景优先",
    system: FPV_PROMPT_SYSTEM,
    triggers: FPV_TRIGGERS,
  },
  {
    id: "title-sequence",
    name: "悬疑片头",
    description: "电影片头设计：关键帧锚定、署名纪律、风格锁、转场系统",
    system: TITLE_SEQUENCE_PROMPT_SYSTEM,
    triggers: TITLE_SEQUENCE_TRIGGERS,
  },
  {
    id: "brand-stream",
    name: "品牌流线MG",
    description: "品牌动效：四段式结构、领航主角、双色霓虹、双保真",
    system: BRAND_STREAM_PROMPT_SYSTEM,
    triggers: BRAND_STREAM_TRIGGERS,
  },
  {
    id: "h3-format",
    name: "H3格式",
    description: "MiniMax H3 官方格式：三段式、参考满足度评估、先问再写",
    system: H3_FORMAT_PROMPT_SYSTEM,
    triggers: H3_FORMAT_TRIGGERS,
  },
  {
    id: "beauty-ad",
    name: "美妆广告",
    description: "彩妆TVC：固定顺序、模特/产品一致性、贴字规则、必带音频",
    system: BEAUTY_AD_PROMPT_SYSTEM,
    triggers: BEAUTY_AD_TRIGGERS,
  },
  {
    id: "wordmark-motion",
    name: "品牌字形动效",
    description: "logo动效：两阶段、文字权威链、最小必要替换、平面2D规则",
    system: WORDMARK_MOTION_PROMPT_SYSTEM,
    triggers: WORDMARK_MOTION_TRIGGERS,
  },
  {
    id: "explainer",
    name: "解释视频",
    description: "科普/解释视频：冷开场、VO-first、拼贴风格、动效纪律",
    system: EXPLAINER_PROMPT_SYSTEM,
    triggers: EXPLAINER_TRIGGERS,
  },
] as const;

/**
 * 意图检测：返回用户提示词命中的所有专项 skill id（多维，可多个同时命中）。
 * 例如"镜头缓慢推进，女人忍住不哭，气氛压抑" →
 * 命中 cinematic（推进/镜头）+ micro-expression（忍住/哭）+ 氛围（如需专项）。
 * 未命中任何专项时返回空数组（只用 base）。
 */
export function detectSkills(prompt: string): string[] {
  const text = prompt.toLowerCase();
  const matched: string[] = [];
  for (const skill of PROMPT_SKILLS) {
    if (skill.id === "base") continue;
    if (skill.triggers.some((t) => text.includes(t.toLowerCase()))) {
      matched.push(skill.id);
    }
  }
  return matched;
}
