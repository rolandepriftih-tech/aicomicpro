"use client";

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  baseUrl: string;
  prompt: string;
  status: "pending" | "success" | "error";
  durationMs: number;
  result?: string;
  error?: string;
}

function mergeLogs(prev: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const map = new Map(prev.map((log) => [log.id, log]));
  for (const log of incoming) {
    if (log.id.startsWith("job-") || log.prompt.startsWith("[异步任务已提交]")) {
      continue;
    }
    map.set(log.id, log);
  }
  return [...map.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);
}

export default function ImageGenLogMonitor() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    let retryDelay = 2000;
    const MAX_RETRY_DELAY = 30000;

    const connect = () => {
      if (es) {
        try { es.close(); } catch { /* ignore */ }
      }
      es = new EventSource("/api/logs/stream");

      es.onmessage = (event) => {
        retryDelay = 2000; // 成功收到消息，重置退避
        try {
          const entry = JSON.parse(event.data) as LogEntry;
          setLogs((prev) => mergeLogs(prev, [entry]));
        } catch {
          // ignore malformed
        }
      };

      es.onerror = () => {
        // 指数退避重连，避免连接风暴
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY);
      };

      es.onopen = () => {
        retryDelay = 2000; // 连接成功，重置退避
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
      };
    };

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (es) {
        try { es.close(); } catch { /* ignore */ }
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const fetchSnapshot = async () => {
      try {
        const res = await fetch("/api/logs/stream?snapshot=1", {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          logs?: LogEntry[];
        };
        if (Array.isArray(data.logs)) {
          setLogs((prev) => mergeLogs(prev, data.logs!));
        }
      } catch {
        // SSE 之外的兜底轮询失败时忽略，下次继续
      }
    };

    fetchSnapshot();
    const snapshotTimer = setInterval(fetchSnapshot, 3000);
    return () => clearInterval(snapshotTimer);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, open]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  const pendingCount = logs.filter((l) => l.status === "pending").length;

  return (
    <section className="shrink-0 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/80">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-800/50"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          📡 生图实时监控台
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-950/60 px-2 py-0.5 text-[10px] text-amber-400">
              <Loader2 className="size-3 animate-spin" />
              {pendingCount} 进行中
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{logs.length} 条</span>
          {open ? (
            <ChevronDown className="size-4 text-zinc-500" />
          ) : (
            <ChevronRight className="size-4 text-zinc-500" />
          )}
        </span>
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="max-h-[260px] overflow-y-auto border-t border-zinc-800/60 px-3 py-2"
        >
          {logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-500">
              暂无日志，开始生图后将实时推送
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const expanded = expandedLogId === log.id;
                return (
                <div
                  key={log.id}
                  className="rounded-md bg-zinc-950/60 px-2.5 py-2 text-[11px]"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left"
                    onClick={() => setExpandedLogId(expanded ? null : log.id)}
                  >
                    {log.status === "pending" && (
                      <Loader2 className="size-3.5 animate-spin text-amber-400" />
                    )}
                    {log.status === "success" && (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    )}
                    {log.status === "error" && (
                      <XCircle className="size-3.5 text-red-400" />
                    )}
                    <span className="font-mono text-zinc-400">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                      {log.provider}
                    </span>
                    <span className="max-w-[120px] truncate text-zinc-500">
                      {log.model}
                    </span>
                    {log.durationMs > 0 && (
                      <span className="ml-auto shrink-0 text-zinc-500">
                        {log.durationMs}ms
                      </span>
                    )}
                    {expanded ? (
                      <ChevronDown className="size-3 shrink-0 text-zinc-500" />
                    ) : (
                      <ChevronRight className="size-3 shrink-0 text-zinc-500" />
                    )}
                  </button>
                  <p
                    className="mt-1 truncate text-zinc-300"
                    title={log.prompt}
                  >
                    {log.prompt}
                  </p>
                  {log.error && (
                    <p
                      className="mt-1 truncate text-red-400"
                      title={log.error}
                    >
                      {log.error}
                    </p>
                  )}
                  {log.result && !log.error && (
                    <p
                      className="mt-1 truncate text-emerald-300/80"
                      title={log.result}
                    >
                      {log.result}
                    </p>
                  )}
                  {expanded && (
                    <div className="mt-2 space-y-1 rounded border border-zinc-800/70 bg-black/40 p-2 text-[10px] leading-relaxed">
                      <p className="break-all text-zinc-500">id: {log.id}</p>
                      <p className="break-all text-zinc-500">baseUrl: {log.baseUrl || "(default)"}</p>
                      <p className="whitespace-pre-wrap break-words text-zinc-300">{log.prompt}</p>
                      {log.result && (
                        <p className="whitespace-pre-wrap break-words text-emerald-300">{log.result}</p>
                      )}
                      {log.error && (
                        <p className="whitespace-pre-wrap break-words text-red-300">{log.error}</p>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
