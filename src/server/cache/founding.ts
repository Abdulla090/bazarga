import "server-only";
import { cacheLife } from "next/cache";
import { db } from "../db";
import { loadFoundingSpotsLeft } from "../services/founding";

/** Founding spots left, recomputed at most every 5 minutes. A DB hiccup returns null and the counter is simply hidden. */
export async function getFoundingSpotsLeft(): Promise<number | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  try {
    return await loadFoundingSpotsLeft(db());
  } catch {
    return null;
  }
}
