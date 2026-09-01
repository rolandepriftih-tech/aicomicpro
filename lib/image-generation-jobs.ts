export type ImageGenerationJobStatus = "pending" | "success" | "error";

export type ImageGenerationJob = {
  id: string;
  status: ImageGenerationJobStatus;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
  error?: string;
  done: Promise<void>;
};

type StoredImageGenerationJob = Omit<ImageGenerationJob, "done"> & {
  done?: Promise<void>;
};

const MAX_JOBS = 100;

declare global {
   
  var __aiComicImageGenerationJobs:
    | Map<string, StoredImageGenerationJob>
    | undefined;
}

const jobs =
  globalThis.__aiComicImageGenerationJobs ??
  new Map<string, StoredImageGenerationJob>();
globalThis.__aiComicImageGenerationJobs = jobs;

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

export function enqueueImageGenerationJob(
  run: () => Promise<{ imageUrl: string }>
): ImageGenerationJob {
  const now = Date.now();
  const id = createJobId();
  const stored: StoredImageGenerationJob = {
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, stored);
  pruneJobs();

  const done = run()
    .then(({ imageUrl }) => {
      Object.assign(stored, {
        status: "success" as const,
        imageUrl,
        updatedAt: Date.now(),
      });
    })
    .catch((err) => {
      const error = err instanceof Error ? err.message : String(err);
      Object.assign(stored, {
        status: "error" as const,
        error,
        updatedAt: Date.now(),
      });
    });

  stored.done = done;
  return { ...stored, done };
}

export function getImageGenerationJob(
  id: string
): ImageGenerationJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  return {
    ...job,
    done: job.done ?? Promise.resolve(),
  };
}
