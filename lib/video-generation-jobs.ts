export type VideoGenerationJobStatus = "pending" | "success" | "error";

export type VideoGenerationJob = {
  id: string;
  status: VideoGenerationJobStatus;
  createdAt: number;
  updatedAt: number;
  videoUrl?: string;
  promptExportUrl?: string;
  prompt?: string;
  mode?: string;
  error?: string;
  done: Promise<void>;
};

type StoredVideoGenerationJob = Omit<VideoGenerationJob, "done"> & {
  done?: Promise<void>;
};

const MAX_JOBS = 100;

declare global {
   
  var __aiComicVideoGenerationJobs:
    | Map<string, StoredVideoGenerationJob>
    | undefined;
}

const jobs =
  globalThis.__aiComicVideoGenerationJobs ??
  new Map<string, StoredVideoGenerationJob>();
globalThis.__aiComicVideoGenerationJobs = jobs;

function createJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pruneJobs() {
  if (jobs.size <= MAX_JOBS) return;
  const ordered = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  for (const job of ordered.slice(0, jobs.size - MAX_JOBS)) {
    jobs.delete(job.id);
  }
}

export function enqueueVideoGenerationJob(
  run: () => Promise<{
    videoUrl?: string;
    promptExportUrl?: string;
    prompt?: string;
    mode?: string;
  }>,
  timeoutMs: number = 20 * 60_000 // 默认 20 分钟超时兜底（覆盖最慢引擎 ~19 分钟的出片时间）
): VideoGenerationJob {
  const now = Date.now();
  const id = createJobId();
  const stored: StoredVideoGenerationJob = {
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, stored);
  pruneJobs();

  // 终态只允许写入一次：超时先到时，后续 run() 的结果不能把 error 翻回 success
  const settle = (patch: Partial<StoredVideoGenerationJob> & { status: VideoGenerationJobStatus }) => {
    if (stored.status !== "pending") return;
    Object.assign(stored, patch, { updatedAt: Date.now() });
  };

  // 超时兜底：如果任务在指定时间内未完成，自动标记为 error
  const timeoutId = setTimeout(() => {
    settle({
      status: "error" as const,
      error: `任务超时（${timeoutMs / 1000}秒），请稍后重试`,
    });
  }, timeoutMs);

  const done = run()
    .then(({ videoUrl, promptExportUrl, prompt, mode }) => {
      clearTimeout(timeoutId);
      settle({
        status: "success" as const,
        videoUrl,
        promptExportUrl,
        prompt,
        mode,
      });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      const error = err instanceof Error ? err.message : String(err);
      settle({ status: "error" as const, error });
    });

  stored.done = done;
  return { ...stored, done };
}

export function getVideoGenerationJob(
  id: string
): VideoGenerationJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  return {
    ...job,
    done: job.done ?? Promise.resolve(),
  };
}
