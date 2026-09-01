export {
  SKILL_CONFIGS,
  SKILL_LIST,
  SKILL_VALUES,
  SKILL_CATEGORIES,
  type SkillConfig,
  type SkillCategory,
  type SkillDifficulty,
} from "./skill-config";

import { SKILL_CONFIGS, SKILL_LIST } from "./skill-config";
import type { SkillConfig, SkillCategory } from "./skill-config";

export function getSkillConfig(id: string): SkillConfig | undefined {
  return SKILL_CONFIGS[id];
}

export function getSkillsByCategory(category: SkillCategory): SkillConfig[] {
  return SKILL_LIST.filter((s) => s.category === category);
}

export function searchSkills(query: string): SkillConfig[] {
  const q = query.toLowerCase().trim();
  if (!q) return SKILL_LIST;
  return SKILL_LIST.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
  );
}
