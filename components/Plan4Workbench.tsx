"use client";

import type {
  Plan4DirectorOutlineResponse,
  Plan4PanelDirective,
  Plan4ImageGenStrategy,
} from "@/types/plan4";
import { PLAN4_STRATEGY_LABELS } from "@/types/plan4";

function strategyBadgeClass(s: Plan4ImageGenStrategy): string {
  switch (s) {
    case "first_last_frame":
      return "bg-amber-950/80 text-amber-100 ring-amber-500/40";
    case "multi_reference":
      return "bg-sky-950/80 text-sky-100 ring-sky-500/40";
    case "nine_grid":
      return "bg-fuchsia-950/80 text-fuchsia-100 ring-fuchsia-500/40";
    default:
      return "bg-zinc-800 text-zinc-200 ring-zinc-500/35";
  }
}

function Plan4PanelRow({ panel }: { panel: Plan4PanelDirective }) {
  const label = PLAN4_STRATEGY_LABELS[panel.generationStrategy];

  return (
    <article className="rounded-xl border border-zinc-700/80 bg-zinc-900/70 p-4 shadow-md shadow-black/15">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-violet-300">
          #{panel.panelIndex}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${strategyBadgeClass(
            panel.generationStrategy
          )}`}
        >
          {label}
        </span>
        {panel.continuityWithPanelIndex != null && (
          <span className="text-[11px] text-zinc-500">
            连贯参考：格 {panel.continuityWithPanelIndex}
          </span>
        )}
      </div>
      <p className="mb-2 text-sm font-medium text-zinc-200">{panel.storyBeat}</p>
      <p className="mb-3 text-sm leading-relaxed text-zinc-400">
        {panel.chineseDirectorNotes}
      </p>
      <div className="mb-3 rounded-lg border border-zinc-700/60 bg-zinc-950/80 px-3 py-2">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          策略理由（导演）
        </span>
        <p className="text-xs leading-relaxed text-zinc-400">
          {panel.strategyRationale}
        </p>
      </div>
      {(panel.primaryReferenceAssets?.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(panel.primaryReferenceAssets ?? []).map((name) => (
            <span
              key={name}
              className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"
            >
              {name}
            </span>
          ))}
        </div>
      )}
      {panel.nineGridCellHints && panel.nineGridCellHints.length > 0 && (
        <div className="mb-3 rounded-lg border border-fuchsia-900/50 bg-fuchsia-950/20 px-3 py-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-fuchsia-400/90">
            九宫格占位 hint
          </span>
          <ul className="list-inside list-disc text-xs text-fuchsia-100/80">
            {panel.nineGridCellHints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          英文生图提示词（后续按策略拆分/路由）
        </span>
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-400 [scrollbar-color:theme(colors.zinc.600)_transparent] [scrollbar-width:thin]">
          {panel.englishImagePrompt}
        </pre>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-500"
          title="后续按 generationStrategy 调用不同生图管线"
        >
          执行生图（待接入）
        </button>
      </div>
    </article>
  );
}

export interface Plan4WorkbenchProps {
  data: Plan4DirectorOutlineResponse;
  onExportJson?: () => void;
}

/**
 * 方案四专用右侧面板：展示导演输出的分镜 + 每格生图策略，占位「执行生图」按钮。
 */
export default function Plan4Workbench({ data, onExportJson }: Plan4WorkbenchProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-amber-900/50 bg-zinc-950 px-5 py-4 shadow-inner">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-amber-200/95">
            方案四 · 导演管线（框架）
          </h2>
          {data.meta?.isStub && (
            <span className="rounded bg-amber-900/60 px-2 py-0.5 text-[10px] font-medium text-amber-100">
              当前为占位数据
            </span>
          )}
        </div>
        {data.meta?.globalContinuityNotes && (
          <p className="mb-3 text-sm leading-relaxed text-zinc-400">
            {data.meta.globalContinuityNotes}
          </p>
        )}
        {data.meta?.stylePrefixHint && (
          <p className="text-xs text-zinc-500">
            <span className="font-semibold text-zinc-400">画风前缀建议：</span>
            {data.meta.stylePrefixHint}
          </p>
        )}
        {onExportJson && (
          <button
            type="button"
            onClick={onExportJson}
            className="mt-4 rounded-md border border-amber-600/60 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/70"
          >
            导出方案四 JSON
          </button>
        )}
      </div>

      <div className="space-y-5">
        {(data.panels ?? []).map((panel) => (
          <Plan4PanelRow key={panel.panelIndex} panel={panel} />
        ))}
      </div>
    </div>
  );
}
