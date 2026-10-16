import "server-only";
import { cacheLife } from "next/cache";
import { db } from "../db";
import { loadShowcaseStores } from "../services/showcase";
import type { ShowcaseStore } from "@/lib/showcase";

/** Showcase stores, recomputed at most every 5 minutes. A DB hiccup returns an empty list (the page shows its CTA state). */
export async function getShowcaseStores(): Promise<ShowcaseStore[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  try {
    return await loadShowcaseStores(db());
  } catch {
    return [];
  }
}
