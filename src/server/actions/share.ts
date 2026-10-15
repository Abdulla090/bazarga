"use server";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { requireStore } from "../auth/session";
import { getProduct } from "../services/catalog";
import { qrMatrix, qrPath } from "@/lib/share-kit";
import { productUrl, withSource } from "@/lib/social";

export type ProductShareKit = {
  ok: true;
  /** Product page URL without `src` (the client adds `?src=<platform>` per link). */
  url: string;
  /** QR for `<url>?src=qr`: module count + one SVG path in module units (drawn on the share canvas). */
  qr: { size: number; path: string };
  /** Cover photo the browser can draw on a canvas without tainting it: a same-origin path or a data: URL; null = none. */
  image: string | null;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * A cross-origin bucket photo (R2/S3) would taint the canvas and block "Download", so the server inlines it as a
 * data: URL. Only the store's own configured public bucket host is ever fetched (no open proxy / SSRF).
 */
async function inlineImage(url: string): Promise<string | null> {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  const pub = env().S3_PUBLIC_URL;
  if (!pub || !url.startsWith("https://")) return null;
  try {
    if (new URL(url).host !== new URL(pub).host) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: "error" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(webp|jpeg|png|avif)$/.test(type.split(";")[0]!.trim())) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch (err) {
    logger.warn("share.image_inline_failed", { err });
    return null;
  }
}

/** Everything the dashboard's per-product Share modal needs. Store comes from the session; other stores' ids 404. */
export async function productShareKitAction(productId: unknown): Promise<ProductShareKit | { ok: false }> {
  try {
    const id = z.uuid().parse(productId);
    const { store } = await requireStore();
    const product = await getProduct(db(), store.id, id);
    if (!product) return { ok: false };
    const url = productUrl(env().APP_URL, store.slug, product.id);
    const qr = qrMatrix(withSource(url, "qr"));
    const cover = product.images[0];
    // Biggest rendition up to ~1280 px wide is plenty for a 936 px photo slot.
    const pick = cover ? [...(cover.renditions ?? [])].sort((a, b) => a.width - b.width).filter((r) => r.width <= 1280).pop()?.url ?? cover.url : null;
    return { ok: true, url, qr: { size: qr.size, path: qrPath(qr) }, image: pick ? await inlineImage(pick) : null };
  } catch (err) {
    logger.warn("share.product_kit_failed", { err });
    return { ok: false };
  }
}
