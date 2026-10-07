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

const NAMES = ["product-dress", "product-honey", "product-cosmetics", "hero"] as const;

type Derived = { name: string; extract?: { left: number; top: number; width: number; height: number }; flop?: boolean };
/** Extra angles/details per source photo (source pixel coordinates). */
export const DERIVED: Record<(typeof NAMES)[number], Derived[]> = {
  "product-dress": [
    { name: "product-dress-collar", extract: { left: 262, top: 40, width: 500, height: 500 } },
    { name: "product-dress-hem", extract: { left: 212, top: 560, width: 600, height: 440 } },
    { name: "product-dress-sleeve", extract: { left: 40, top: 120, width: 480, height: 480 } },
    { name: "product-dress-full", flop: true },
  ],
  "product-honey": [
    { name: "product-honey-jar", extract: { left: 200, top: 220, width: 560, height: 560 } },
    { name: "product-honey-dipper", extract: { left: 430, top: 380, width: 560, height: 560 } },
    { name: "product-honey-pot", extract: { left: 500, top: 0, width: 524, height: 524 } },
  ],
  "product-cosmetics": [
    { name: "product-cosmetics-serum", extract: { left: 240, top: 220, width: 480, height: 640 } },
    { name: "product-cosmetics-cream", extract: { left: 500, top: 380, width: 520, height: 520 } },
    { name: "product-cosmetics-flowers", extract: { left: 660, top: 440, width: 364, height: 364 } },
  ],
  hero: [
    { name: "product-scarf", extract: { left: 520, top: 400, width: 600, height: 270 } },
    { name: "product-scarf-seller", extract: { left: 300, top: 40, width: 630, height: 630 } },
    { name: "product-scarf-shelf", extract: { left: 500, top: 0, width: 400, height: 400 } },
  ],
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
