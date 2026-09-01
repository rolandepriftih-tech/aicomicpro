import { describe, it, expect } from "vitest";
import { detectSkills, composeSystemPrompt, PROMPT_SKILLS } from "../lib/prompt-skills";

describe("detectSkills 意图检测", () => {
  const cases: [string, string[]][] = [
    ["让飞机穿过庭院飞起来，有压迫感", []],
    ["镜头缓慢推进到人物脸上，画面很孤独", ["cinematic"]],
    ["女人听到坏消息忍住不哭", ["micro-expression"]],
    ["镜头从窗外推进，女人强撑着不哭，冷色调压抑", ["cinematic", "micro-expression"]],
    ["口红广告镜头缓慢推进，模特忍泪", ["beauty-ad", "cinematic", "micro-expression"]],
    ["FPV穿越中式庭院，贴水掠飞", ["fpv"]],
    ["制作一个悬疑电影片头", ["title-sequence"]],
    ["科普视频讲解黑洞", ["explainer"]],
    ["做一个品牌的logo动效", ["brand-stream", "wordmark-motion"]],
  ];

  it("按提示词命中对应专项模板（可多维同时命中）", () => {
    for (const [input, expected] of cases) {
      const got = detectSkills(input).sort();
      expect(got, input).toEqual([...expected].sort());
    }
  });

  it("composeSystemPrompt 叠加 base 与命中专项", () => {
    const system = composeSystemPrompt(["cinematic", "micro-expression"]);
    expect(system).toContain("你是顶级影视导演");
    expect(system).toContain("【电影质感专项规则（用户描述涉及该维度，必须遵守）】");
    expect(system).toContain("【微表情表演专项规则（用户描述涉及该维度，必须遵守）】");
  });

  it("注册表包含 base + 9 个专项", () => {
    expect(PROMPT_SKILLS.length).toBe(10);
    expect(PROMPT_SKILLS[0].id).toBe("base");
  });
});
