/**
 * 从 LLM 输出中提取合法 JSON 字符串。
 * 处理 markdown 代码块、前后说明文字、多行输出、控制字符等常见污染情况。
 */
export function extractJsonFromLlmOutput(text: string): string {
  // 0. 清洗不可见污染字符（BOM、零宽空格、零宽连接符、控制字符等）
  const cleaned = text
    .replace(/^﻿/, "") // BOM
    .replace(/[​-‍﻿⁠᠎]/g, "") // 零宽字符
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""); // 控制字符（保留 \n \r \t）

  const trimmed = cleaned.trim();

  // 1. 尝试提取 ```json ... ``` 或 ``` ... ``` 代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2. 如果没有代码块，尝试定位第一个 { 或 [ 到最后一个 } 或 ]
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start !== -1) {
    const lastBrace = trimmed.lastIndexOf("}");
    const lastBracket = trimmed.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    if (end !== -1 && end >= start) {
      return trimmed.slice(start, end + 1).trim();
    }
  }

  // 3. 兜底：直接返回原文，让 JSON.parse 自己尝试
  return trimmed;
}
