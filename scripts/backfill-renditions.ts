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
 * Cached storefront pages pick the new srcset up on their next revalidation.
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/server/db";
import { productImages, stores, type ImageRendition } from "../src/server/db/schema";
import { LocalDiskStorage, storage } from "../src/server/storage";
import { addMissingRenditions, missingRenditionWidths } from "../src/server/storage/pipeline";

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
