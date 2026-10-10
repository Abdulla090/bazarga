/*
 * Run the upload pipeline over the demo photos in public/images and write the WebP renditions to
 * public/images/seed/ plus a manifest (scripts/seed-images.json) that scripts/seed.ts reads — so the demo store
 * exercises srcset/placeholders and multi-photo galleries without needing a storage bucket or any download.
 * Extra gallery photos are derived from the same originals with sharp: detail crops (collar, hem, jar…) and one
 * mirrored full view. Re-run after changing a demo photo:
 *   npx tsx scripts/build-seed-images.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { processImage } from "../src/server/storage/pipeline";

const NAMES = ["product-shirt", "product-mugs", "product-skincare", "product-tote", "hero"] as const;

type Derived = { name: string; extract?: { left: number; top: number; width: number; height: number }; flop?: boolean };
/** Extra angles/details per source photo (source pixel coordinates; sources are 1024×1024, hero 1376×768). */
export const DERIVED: Record<(typeof NAMES)[number], Derived[]> = {
  "product-shirt": [
    { name: "product-shirt-collar", extract: { left: 312, top: 90, width: 400, height: 400 } },
    { name: "product-shirt-hem", extract: { left: 262, top: 560, width: 500, height: 400 } },
    { name: "product-shirt-sleeve", extract: { left: 80, top: 300, width: 420, height: 420 } },
    { name: "product-shirt-full", flop: true },
  ],
  "product-mugs": [
    { name: "product-mugs-left", extract: { left: 180, top: 250, width: 440, height: 440 } },
    { name: "product-mugs-right", extract: { left: 520, top: 200, width: 440, height: 440 } },
    { name: "product-mugs-saucer", extract: { left: 340, top: 440, width: 480, height: 360 } },
  ],
  "product-skincare": [
    { name: "product-skincare-serum", extract: { left: 280, top: 280, width: 300, height: 420 } },
    { name: "product-skincare-pump", extract: { left: 440, top: 200, width: 320, height: 440 } },
    { name: "product-skincare-jar", extract: { left: 540, top: 500, width: 300, height: 280 } },
  ],
  "product-tote": [
    { name: "product-tote-handles", extract: { left: 362, top: 60, width: 320, height: 320 } },
    { name: "product-tote-detail", extract: { left: 330, top: 420, width: 400, height: 400 } },
  ],
  hero: [],
};

const OUT = path.join(process.cwd(), "public/images/seed");

async function emit(name: string, bytes: Uint8Array, manifest: Record<string, unknown>) {
  const img = await processImage(bytes, { maxMb: 10 });
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

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest: Record<string, unknown> = {};
  for (const name of NAMES) {
    const src = await readFile(path.join(process.cwd(), "public/images", `${name}.jpg`));
    await emit(name, new Uint8Array(src), manifest);
    for (const d of DERIVED[name]) {
      let s = sharp(src);
      if (d.extract) s = s.extract(d.extract);
      if (d.flop) s = s.flop();
      await emit(d.name, new Uint8Array(await s.jpeg({ quality: 92 }).toBuffer()), manifest);
    }
  }
  await writeFile(path.join(process.cwd(), "scripts/seed-images.json"), JSON.stringify(manifest, null, 2) + "\n");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
