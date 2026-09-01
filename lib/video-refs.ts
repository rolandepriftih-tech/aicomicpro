import fs from "fs/promises";
import path from "path";
import { extractVideoTaskId } from "./video-url";

export { extractVideoTaskId };

/**
 * 视频引用清单：记录画布节点正在引用的视频 taskId（及最近一次上报时间）。
 * cleanupOldVideos 清理前查这份清单，跳过仍被引用的文件——否则用户每生成
 * 一个新视频，旧的画布视频就可能被"7 天 / 最近 20 个"规则删成 404。
 *
 * 引用信息只能由浏览器上报（画布数据在 localStorage/内存里，服务端看不到），
 * 清单条目带 lastSeenAt：超过 REF_STALE_MS 未再上报的视为僵尸引用
 * （节点早就删了），放行清理并从清单剔除，防止清单无限膨胀。
 */

const OUTPUT_DIR = path.join(process.cwd(), "output");
const REFS_FILE = path.join(OUTPUT_DIR, "videos", ".video-refs.json");

/** 引用条目多久没有重新上报就视为失效（30 天） */
export const REF_STALE_MS = 30 * 24 * 60 * 60 * 1000;

type VideoRefs = Record<string, number>;

async function readRefs(): Promise<VideoRefs> {
  try {
    const raw = await fs.readFile(REFS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as VideoRefs) : {};
  } catch {
    return {};
  }
}

async function writeRefs(refs: VideoRefs): Promise<void> {
  await fs.mkdir(path.dirname(REFS_FILE), { recursive: true });
  await fs.writeFile(REFS_FILE, JSON.stringify(refs), "utf8");
}

/** 上报一批 taskId 为"仍在引用"，刷新 lastSeenAt */
export async function touchVideoRefs(taskIds: string[]): Promise<void> {
  const valid = [...new Set(taskIds.filter((id) => typeof id === "string" && id.trim()))];
  if (valid.length === 0) return;
  const refs = await readRefs();
  const now = Date.now();
  for (const id of valid) refs[id] = now;
  await writeRefs(refs);
}

/**
 * 当前仍活跃的引用 taskId 集合（剔除超过 REF_STALE_MS 未上报的僵尸条目）。
 * 只读时同样剔除僵尸条目会带来写盘开销，这里返回"清单 ∩ 未过期"，由清理方决定是否落盘。
 */
export async function getActiveVideoRefs(): Promise<Set<string>> {
  const refs = await readRefs();
  const now = Date.now();
  const active = new Set<string>();
  for (const [id, lastSeenAt] of Object.entries(refs)) {
    if (now - lastSeenAt < REF_STALE_MS) active.add(id);
  }
  return active;
}

/** 清理后调用：从清单中剔除已不存在的 taskId，防止无限膨胀 */
export async function pruneVideoRefs(aliveTaskIds: Set<string>): Promise<void> {
  const refs = await readRefs();
  const next: VideoRefs = {};
  let changed = false;
  for (const [id, lastSeenAt] of Object.entries(refs)) {
    const alive = aliveTaskIds.has(id) && Date.now() - lastSeenAt < REF_STALE_MS;
    if (alive) {
      next[id] = lastSeenAt;
    } else {
      changed = true;
    }
  }
  if (changed) await writeRefs(next);
}
