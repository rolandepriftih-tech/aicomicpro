"use client";

import { useState } from "react";
import { Mic, Play, Pause, Download, Loader2 } from "lucide-react";
import { MIMO_VOICES, MIMO_STYLES } from "@/lib/tts";

interface VoicePanelProps {
  /** 当前分镜面板的台词文本 */
  dialogues: Array<{ panelId: string; text: string }>;
  /** API Key */
  apiKey: string;
  /** 语音模型 */
  voiceModel?: string;
  /** 语音生成完成回调 */
  onVoiceGenerated?: (panelId: string, audioUrl: string) => void;
}

export default function VoicePanel({
  dialogues,
  apiKey,
  voiceModel: _voiceModel = "speech-02-hd",
  onVoiceGenerated,
}: VoicePanelProps) {
  const [selectedVoice, setSelectedVoice] = useState("mimo_default");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [generatingPanelId, setGeneratingPanelId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [playingPanelId, setPlayingPanelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateVoice = async (panelId: string, text: string) => {
    if (!apiKey) {
      setError("请先配置 API Key");
      return;
    }

    setGeneratingPanelId(panelId);
    setError(null);

    try {
      const response = await fetch("/api/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "mimo",
          apiKey,
          text,
          voice: selectedVoice,
          style: selectedStyle || undefined,
          format: "wav",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "语音生成失败");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      setAudioUrls((prev) => ({ ...prev, [panelId]: audioUrl }));
      onVoiceGenerated?.(panelId, audioUrl);
    } catch (err: any) {
      setError(err.message || "语音生成失败");
    } finally {
      setGeneratingPanelId(null);
    }
  };

  const handlePlay = (panelId: string) => {
    const audioUrl = audioUrls[panelId];
    if (!audioUrl) return;

    if (playingPanelId === panelId) {
      // 暂停当前播放
      const audio = document.querySelector(`audio[data-panel-id="${panelId}"]`) as HTMLAudioElement;
      if (audio) audio.pause();
      setPlayingPanelId(null);
    } else {
      // 停止之前播放的
      if (playingPanelId) {
        const prevAudio = document.querySelector(`audio[data-panel-id="${playingPanelId}"]`) as HTMLAudioElement;
        if (prevAudio) prevAudio.pause();
      }
      setPlayingPanelId(panelId);
    }
  };

  const handleDownload = (panelId: string) => {
    const audioUrl = audioUrls[panelId];
    if (!audioUrl) return;

    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `voice-${panelId}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateAll = async () => {
    for (const { panelId, text } of dialogues) {
      if (text && !audioUrls[panelId]) {
        await handleGenerateVoice(panelId, text);
      }
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Mic className="w-4 h-4" />
        <span>配音工作台</span>
      </div>

      {/* 语音配置 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="block text-gray-600 mb-1">音色选择</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
          >
            {MIMO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} - {v.description}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-600 mb-1">风格选择</label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
          >
            {MIMO_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 批量生成按钮 */}
      <button
        onClick={handleGenerateAll}
        disabled={!apiKey || dialogues.length === 0}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Mic className="w-4 h-4" />
        一键生成全部配音
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* 台词列表 */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {dialogues.map(({ panelId, text }) => (
          <div
            key={panelId}
            className="border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-1">
                  面板 {panelId}
                </div>
                <div className="text-sm text-gray-800 line-clamp-2">
                  {text || "(无台词)"}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleGenerateVoice(panelId, text)}
                disabled={!apiKey || !text || generatingPanelId === panelId}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {generatingPanelId === panelId ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Mic className="w-3 h-3" />
                )}
                生成
              </button>

              {audioUrls[panelId] && (
                <>
                  <audio
                    data-panel-id={panelId}
                    src={audioUrls[panelId]}
                    onEnded={() => setPlayingPanelId(null)}
                    className="hidden"
                  />
                  <button
                    onClick={() => handlePlay(panelId)}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 flex items-center gap-1"
                  >
                    {playingPanelId === panelId ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {playingPanelId === panelId ? "暂停" : "播放"}
                  </button>
                  <button
                    onClick={() => handleDownload(panelId)}
                    className="bg-gray-600 text-white px-3 py-1.5 rounded text-xs hover:bg-gray-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    下载
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
