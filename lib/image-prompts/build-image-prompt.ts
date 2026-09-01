import type { ImagePromptContext, ImageReferenceMeta } from "@/lib/image-generation-types";

const HUMAN_SUBJECT_PATTERN =
  /\b(person|people|human|man|woman|boy|girl|male|female|child|kid|teen|adult|character|protagonist|hero|heroine|actor|actress|portrait|face|body|hands?|standing|sitting|wearing)\b|人物|角色|人类|真人|男人|女人|男孩|女孩|少年|少女|儿童|孩子|主角|英雄|脸|面部|身体|手|站立|坐着|穿着|发型|表情/iu;

const WEAK_PROMPT_PATTERN = /^[\s\d._#-]+$/u;

export function isWeakImagePrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (normalized.length < 6) return true;
  return WEAK_PROMPT_PATTERN.test(normalized);
}

function mentionsHumanSubject(prompt: string): boolean {
  return HUMAN_SUBJECT_PATTERN.test(prompt);
}

function formatReferences(references: ImageReferenceMeta[] = []): string {
  if (references.length === 0) return "";
  const lines = references
    .map((ref, index) => `${index + 1}. ${ref.type}: ${ref.name}`)
    .join("; ");
  return `Reference map: ${lines}. Use reference images only for the stated role. Do not copy unrelated subjects from a reference image.`;
}

function taskRule(ctx: ImagePromptContext, prompt: string): string {
  switch (ctx.taskType) {
    case "asset-character":
      return "Task: create a pure character design sheet. Show the character only. Do not add weapons, props held in hands, extra people, scenery focus, dialogue text, watermarks, or storyboard panels.";
    case "asset-creature":
      return "Task: create a pure creature design sheet. Show the creature only. Do not add humans, riders, handlers, weapons, dialogue text, watermarks, or storyboard panels.";
    case "asset-scene":
      return "Task: create pure environment concept art. Absolutely no people, human figures, characters, faces, hands, bodies, clothing, silhouettes, portraits, or posed subjects. Focus only on architecture, space, lighting, layout, atmosphere, and environmental details.";
    case "asset-prop":
      return "Task: create a pure prop/object design sheet. Absolutely no people, hands holding the object, faces, bodies, clothing, posed subjects, scenery focus, dialogue text, or storyboard panels. Show the object clearly with material and form details.";
    case "asset-cockpit":
      return "Task: create a cockpit/vehicle/interior design sheet. Do not add pilots, people, faces, hands, bodies, clothing, or posed subjects unless explicitly requested. Focus on controls, structure, materials, lighting, and layout.";
    case "asset-custom":
      if (mentionsHumanSubject(prompt)) {
        return "Task: create the custom asset described by the user. Follow the prompt literally and do not add unrelated reference-image subjects.";
      }
      return "Task: create the custom non-human asset described by the user. Do not add people, human figures, characters, faces, hands, bodies, clothing, poses, or silhouettes unless explicitly requested.";
    case "panel-storyboard":
      return "Task: create a single storyboard/comic panel. Use referenced characters or scenes only when named. Do not introduce new main characters. Keep composition readable and cinematic.";
    case "image-edit":
      return "Task: edit or regenerate from the reference image according to the instruction. Preserve only the relevant subject, composition, and style requested by the user.";
    case "image-variation":
      return "Task: create a visual variation from the reference image. Preserve the relevant subject identity and style, but follow the user's prompt over unrelated reference details.";
    default:
      return "Task: create an image following the user prompt literally.";
  }
}

export function buildImagePrompt(prompt: string, ctx: ImagePromptContext): string {
  const trimmedPrompt = prompt.trim();
  const parts = [
    taskRule(ctx, trimmedPrompt),
    ctx.assetName ? `Asset name: ${ctx.assetName}.` : "",
    `User prompt: ${trimmedPrompt}.`,
    formatReferences(ctx.references),
    ctx.stylePrefix ? `Style: ${ctx.stylePrefix}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}
