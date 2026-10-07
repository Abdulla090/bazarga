/**
 * Generates the PWA / Apple icons from the brand mark (public/icon.svg) with sharp:
 *   node scripts/build-icons.mjs
 * - icon-{192,512}.png          "any" purpose: the rounded mark as-is on a transparent canvas
 * - maskable-{192,512}.png      "maskable": full-bleed ink background, mark scaled into the 80% safe zone
 * - apple-touch-icon.png (180)  iOS home screen: opaque, square (iOS rounds the corners itself)
 * Output is committed; re-run only when the brand mark changes.
 */
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";

const INK = "#0F1B2D";
const svg = readFileSync("public/icon.svg");
mkdirSync("public/icons", { recursive: true });

async function plain(size, out) {
  await sharp(svg, { density: 1200 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
}

async function padded(size, scale, out) {
  const inner = Math.round(size * scale);
  const mark = await sharp(svg, { density: 1200 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: mark, gravity: "center" }])
    .flatten({ background: INK })
    .png({ compressionLevel: 9 })
    .toFile(out);
}

await plain(192, "public/icons/icon-192.png");
await plain(512, "public/icons/icon-512.png");
await padded(192, 0.78, "public/icons/maskable-192.png");
await padded(512, 0.78, "public/icons/maskable-512.png");
await padded(180, 0.92, "public/apple-touch-icon.png");
console.log("icons written to public/icons and public/apple-touch-icon.png");
