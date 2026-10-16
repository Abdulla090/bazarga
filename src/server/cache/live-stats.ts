import "server-only";
import { cacheLife } from "next/cache";
import { db } from "../db";
import { loadLiveStats } from "../services/live-stats";
import type { LiveStats } from "@/lib/live-stats";

/** Landing counters, recomputed at most every 5 minutes (4 cheap COUNTs). A DB hiccup hides the band instead of breaking the page. */
export async function getLiveStats(): Promise<LiveStats | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  try {
    return await loadLiveStats(db());
  } catch {
    return null;
  }
}
