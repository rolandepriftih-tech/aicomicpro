/**
 * 生图请求日志记录器 + SSE 实时推送
 * 使用内存存储最近 50 条日志，支持多客户端 SSE 订阅
 */

export interface ImageGenLogEntry {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  baseUrl: string;
  prompt: string;
  status: "pending" | "success" | "error";
  statusCode?: number;
  durationMs: number;
  result?: string;
  error?: string;
}

const MAX_LOGS = 50;

declare global {
   
  var __aiComicImageGenLogs: ImageGenLogEntry[] | undefined;
   
  var __aiComicImageGenLogSubscribers:
    | Set<ReadableStreamDefaultController>
    | undefined;
}

let logs = globalThis.__aiComicImageGenLogs ?? [];
globalThis.__aiComicImageGenLogs = logs;

const subscribers =
  globalThis.__aiComicImageGenLogSubscribers ??
  new Set<ReadableStreamDefaultController>();
globalThis.__aiComicImageGenLogSubscribers = subscribers;

function broadcast(log: ImageGenLogEntry) {
  const data = `data: ${JSON.stringify(log)}\n\n`;
  subscribers.forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      // 客户端断开时忽略
    }
  });
}

export function addLog(log: ImageGenLogEntry) {
  logs.push(log);
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
    globalThis.__aiComicImageGenLogs = logs;
  }
  broadcast(log);
}

export function updateLog(
  id: string,
  patch: Partial<Omit<ImageGenLogEntry, "id" | "timestamp">>
) {
  const entry = logs.find((l) => l.id === id);
  if (entry) {
    Object.assign(entry, patch);
    broadcast(entry);
  }
}

export function getLogs(): ImageGenLogEntry[] {
  return [...logs];
}

export function subscribe(controller: ReadableStreamDefaultController) {
  subscribers.add(controller);
  // 推送历史日志
  logs.forEach((log) => {
    try {
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(log)}\n\n`)
      );
    } catch {
      // ignore
    }
  });
}

export function unsubscribe(controller: ReadableStreamDefaultController) {
  subscribers.delete(controller);
}
