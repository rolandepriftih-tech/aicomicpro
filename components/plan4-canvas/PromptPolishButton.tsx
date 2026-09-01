"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface PromptPolishButtonProps {
  prompt: string;
  onPolished: (polishedPrompt: string) => void;
  textApiKey?: string;
  textProvider?: "gemini" | "openai";
  textModel?: string;
  textBaseUrl?: string;
  disabled?: boolean;
}

export default function PromptPolishButton({
  prompt,
  onPolished,
  textApiKey,
  textProvider,
  textModel,
  textBaseUrl,
  disabled,
}: PromptPolishButtonProps) {
  const [isPolishing, setIsPolishing] = useState(false);

  const handlePolish = async () => {
    if (!prompt.trim() || isPolishing) return;

    setIsPolishing(true);
    try {
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          skill: "base",
          textApiKey,
          textProvider,
          textModel,
          baseUrl: textBaseUrl,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        polished?: string;
        error?: string;
      };

      if (res.ok && data.success && data.polished) {
        onPolished(data.polished);
      } else {
        console.error("[PromptPolish] 润色失败:", data.error);
      }
    } catch (err) {
      console.error("[PromptPolish] 润色异常:", err);
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePolish}
      disabled={disabled || !prompt.trim() || isPolishing}
      className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2.5 py-1.5 text-[10px] font-medium text-white hover:from-violet-600 hover:to-purple-600 disabled:from-zinc-300 disabled:to-zinc-300 disabled:text-zinc-500 transition-all"
      title="AI 润色提示词"
    >
      {isPolishing ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          润色中
        </>
      ) : (
        <>
          <Sparkles className="size-3" />
          润色
        </>
      )}
    </button>
  );
}
