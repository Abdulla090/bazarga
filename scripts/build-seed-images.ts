/*
 * Run the upload pipeline over the demo photos in public/images and write the WebP renditions to
 * public/images/seed/ plus a manifest (scripts/seed-images.json) that scripts/seed.ts reads — so the demo store
 * exercises srcset/placeholders without needing a storage bucket. Re-run after changing a demo photo:
 *   npx tsx scripts/build-seed-images.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { processImage } from "../src/server/storage/pipeline";

const NAMES = ["product-dress", "product-honey", "product-cosmetics", "hero"] as const;
const OUT = path.join(process.cwd(), "public/images/seed");

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest: Record<string, unknown> = {};
  for (const name of NAMES) {
    const img = await processImage(new Uint8Array(await readFile(path.join(process.cwd(), "public/images", `${name}.jpg`))), { maxMb: 10 });
    const renditions = [];
    for (const r of img.renditions) {
      const file = `${name}-${r.width}.webp`;
      await writeFile(path.join(OUT, file), r.data);
      renditions.push({ width: r.width, height: r.height, key: `seed/${file}`, url: `/images/seed/${file}`, bytes: r.data.byteLength });
    }
    const def = renditions.find((r) => r.width >= 1024) ?? renditions[renditions.length - 1]!;
    manifest[name] = { url: def.url, width: img.width, height: img.height, placeholder: img.placeholder, dominantColor: img.dominantColor, renditions };
    console.log(name, renditions.map((r) => `${r.width}w ${(r.bytes / 1024).toFixed(0)}KB`).join(", "));
  }
  await writeFile(path.join(process.cwd(), "scripts/seed-images.json"), JSON.stringify(manifest, null, 2) + "\n");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
