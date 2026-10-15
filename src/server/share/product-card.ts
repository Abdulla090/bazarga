import "server-only";
import sharp, { type OverlayOptions } from "sharp";
import { textBlock } from "./story";
import type { ThemeTokens } from "@/lib/theme";

/** Link-preview card (1200×630 PNG) for one product: cover photo on the left, name, price and store on the right. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export type ProductCardInput = {
  name: string;
  price: string;
  compareAt: string | null;
  store: string;
  /** Cover image bytes; null → brand panel only. */
  image: Uint8Array | null;
  theme: Pick<ThemeTokens, "hero" | "onHero" | "accent" | "onAccent">;
};

export async function renderProductCardPng(i: ProductCardInput): Promise<Buffer> {
  const { width: W, height: H } = OG_SIZE;
  const t = i.theme;
  const PHOTO = i.image ? 630 : 0;
  const colW = W - PHOTO - 120;
  const layers: OverlayOptions[] = [];
  if (i.image) {
    try {
      layers.push({ input: await sharp(i.image, { limitInputPixels: 40_000_000 }).rotate().resize(PHOTO, H, { fit: "cover" }).png().toBuffer(), left: 0, top: 0 });
    } catch {
      /* unreadable cover → text-only card */
    }
  }
  const left = layers.length ? PHOTO + 60 : 60;
  const width = W - left - 60;
  const [name, price, was, store] = await Promise.all([
    textBlock(i.name, { weight: "bold", px: 64, color: t.onHero, width: Math.min(width, colW + 0), maxHeight: 250 }),
    textBlock(i.price, { weight: "bold", px: 56, color: t.onAccent, width: 460 }),
    i.compareAt ? textBlock(i.compareAt, { weight: "regular", px: 34, color: t.onHero, width: 460, opacity: 0.65 }) : Promise.resolve(null),
    textBlock(i.store, { weight: "regular", px: 36, color: t.onHero, width: Math.min(width, colW), maxHeight: 100, opacity: 0.85 }),
  ]);
  let y = 70;
  layers.push({ input: name.data, left, top: y });
  y += name.height + 40;
  const pillW = price.width + 80;
  const pillH = price.height + 36;
  layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pillW}" height="${pillH}"><rect width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${t.accent}"/></svg>`), left, top: y });
  layers.push({ input: price.data, left: left + 40, top: y + 18 });
  y += pillH + 20;
  if (was) layers.push({ input: was.data, left, top: y });
  layers.push({ input: store.data, left, top: H - store.height - 56 });
  return sharp({ create: { width: W, height: H, channels: 3, background: t.hero } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
