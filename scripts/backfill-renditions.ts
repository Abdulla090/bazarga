/*
 * Add renditions the upload pipeline gained after an image was uploaded (today: the 480 w product-grid size)
 * to existing product photos and store covers. Reads the largest stored WebP, resizes it, writes the new files
 * next to the old ones through the configured storage adapter and updates the jsonb rendition list.
 * Idempotent and safe to re-run; seed/legacy rows (non-pipeline keys) are skipped. Stores are processed one by
 * one, and every UPDATE is scoped to the row's own store_id (tenant isolation).
 *
 *   npm run images:backfill            → apply
 *   npm run images:backfill -- --dry   → only count what would change
 *
 * Seed rows (keys under seed/) are not resized: their rendition list is reset to the current
 * scripts/seed-images.json entry when it names files the seed build no longer generates (e.g. the pre-lean
 * hero-1376.webp, which 404s).
 *
 * Cached storefront pages pick the new srcset up on their next revalidation.
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/server/db";
import { productImages, stores, type ImageRendition } from "../src/server/db/schema";
import { LocalDiskStorage, storage } from "../src/server/storage";
import { addMissingRenditions, missingRenditionWidths } from "../src/server/storage/pipeline";
import seedImages from "./seed-images.json";

/** Current seed manifest entry for a stale seed rendition list (matched by the file stem), or null. */
const SEED = seedImages as Record<string, { renditions: ImageRendition[] }>;
const SEED_KEYS = new Set(Object.values(SEED).flatMap((e) => e.renditions.map((r) => r.key)));
function staleSeedFix(list: readonly ImageRendition[]): ImageRendition[] | null {
  if (!list.length || !list.every((r) => r.key.startsWith("seed/"))) return null;
  if (list.every((r) => SEED_KEYS.has(r.key))) return null;
  const stem = /^seed\/(.+)-\d+\.webp$/.exec(list[0]!.key)?.[1];
  const entry = stem ? SEED[stem] : undefined;
  return entry ? entry.renditions : null;
}

async function readSource(r: ImageRendition): Promise<Uint8Array> {
  const s = storage();
  if (s instanceof LocalDiskStorage) return new Uint8Array(await s.read(r.key));
  const res = await fetch(r.url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const top = (list: readonly ImageRendition[]) => [...list].sort((a, b) => b.width - a.width)[0]!;

async function main() {
  const dry = process.argv.includes("--dry");
  const database = createDb(process.env.DATABASE_URL ?? "pglite://./.pglite");
  let images = 0;
  let covers = 0;
  let failed = 0;

  for (const img of await database.select({ id: productImages.id, storeId: productImages.storeId, renditions: productImages.renditions }).from(productImages)) {
    const seedFix = staleSeedFix(img.renditions);
    if (seedFix) {
      if (!dry) await database.update(productImages).set({ renditions: seedFix }).where(and(eq(productImages.id, img.id), eq(productImages.storeId, img.storeId)));
      images++;
      continue;
    }
    if (!missingRenditionWidths(img.renditions.map((r) => r.width)).length) continue;
    if (dry) { images++; continue; }
    try {
      const next = await addMissingRenditions(storage(), img.storeId, img.renditions, await readSource(top(img.renditions)));
      if (!next) continue;
      await database.update(productImages).set({ renditions: next }).where(and(eq(productImages.id, img.id), eq(productImages.storeId, img.storeId)));
      images++;
    } catch (err) {
      failed++;
      console.error(`[backfill] product image ${img.id}:`, err instanceof Error ? err.message : err);
    }
  }

  for (const st of await database.select({ id: stores.id, renditions: stores.coverImageRenditions }).from(stores)) {
    const seedFix = staleSeedFix(st.renditions);
    if (seedFix) {
      if (!dry) await database.update(stores).set({ coverImageRenditions: seedFix }).where(eq(stores.id, st.id));
      covers++;
      continue;
    }
    if (!missingRenditionWidths(st.renditions.map((r) => r.width)).length) continue;
    if (dry) { covers++; continue; }
    try {
      const next = await addMissingRenditions(storage(), st.id, st.renditions, await readSource(top(st.renditions)));
      if (!next) continue;
      await database.update(stores).set({ coverImageRenditions: next }).where(eq(stores.id, st.id));
      covers++;
    } catch (err) {
      failed++;
      console.error(`[backfill] store cover ${st.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[backfill] ${dry ? "would update" : "updated"} ${images} product images, ${covers} store covers; ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
