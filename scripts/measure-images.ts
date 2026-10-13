/*
 * Bytes per uploaded image across all renditions (docs/CAPACITY.md). Usage:
 *   npx tsx scripts/measure-images.ts photo1.jpg photo2.jpg photo3.jpg
 */
import { readFile } from "node:fs/promises";
import { processImage } from "../src/server/storage/pipeline";

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("usage: npx tsx scripts/measure-images.ts <image>...");
  let total = 0;
  for (const f of files) {
    const img = await processImage(new Uint8Array(await readFile(f)), { maxMb: 50 });
    const bytes = img.renditions.reduce((a, r) => a + r.data.byteLength, 0);
    total += bytes;
    console.log(f, img.renditions.map((r) => `${r.width}w ${r.data.byteLength}`).join(" · "), `= ${bytes} B`, `placeholder ${img.placeholder.length} chars`);
  }
  console.log(`average ${Math.round(total / files.length)} B per image (all renditions)`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
