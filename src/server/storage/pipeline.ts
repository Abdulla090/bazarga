import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { ImageRendition } from "../db/schema";
import { AppError } from "../errors";
import { validateImage } from "./image";

/**
 * Upload image pipeline (Iraqi mobile networks: every byte counts).
 *
 *  1. Validate by magic bytes + size (client MIME is never trusted).
 *  2. Decode with a pixel cap (decompression-bomb guard), first frame only.
 *  3. Apply EXIF orientation, then drop *all* metadata — EXIF (incl. GPS position of the seller's home),
 *     XMP, IPTC and ICC (converted to sRGB first so colours survive).
 *  4. Emit WebP renditions at RENDITION_WIDTHS, never upscaling (the original width is kept as the top size
 *     when it is smaller than the largest target).
 *  5. Compute a ~16 px blurred WebP data: URL placeholder (LQIP) and the dominant colour.
 *
 * Storage is abstract: `storeImage()` writes through any `StorageAdapter` (local disk, S3/R2 — see ./config.ts).
 */
/**
 * 480 sits between the phone grid tile (2 columns ≈ 173–195 CSS px × DPR 2–2.75) and the 640 hero size, so
 * product-grid thumbnails stop downloading the 640 file on most phones (docs/PERFORMANCE.md).
 */
export const RENDITION_WIDTHS = [320, 480, 640, 1024, 1600] as const;
export const DEFAULT_RENDITION_WIDTH = 1024;
export const MAX_INPUT_PIXELS = 50_000_000; // ~ 8660×5773 — anything above is rejected, not decoded
const WEBP_QUALITY = 78;
const PLACEHOLDER_WIDTH = 16;

export type ProcessedRendition = { width: number; height: number; data: Buffer };
export type ProcessedImage = {
  width: number;
  height: number;
  renditions: ProcessedRendition[];
  placeholder: string;
  dominantColor: string;
};

/** Target widths for a source of `sourceWidth` px: every target below it, plus the source width itself (capped). */
export function renditionWidths(sourceWidth: number, targets: readonly number[] = RENDITION_WIDTHS): number[] {
  if (!Number.isInteger(sourceWidth) || sourceWidth <= 0) throw new Error(`Invalid width: ${sourceWidth}`);
  const max = targets[targets.length - 1]!;
  const below = targets.filter((w) => w < sourceWidth);
  const top = Math.min(sourceWidth, max);
  return [...new Set([...below, top])].sort((a, b) => a - b);
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

export async function processImage(input: Uint8Array, opts: { maxMb: number }): Promise<ProcessedImage> {
  validateImage(input, opts.maxMb);
  const decode = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 });

  let oriented: { data: Buffer; info: sharp.OutputInfo };
  try {
    // rotate() with no args = apply EXIF Orientation. Output to a lossless intermediate in sRGB; sharp does
    // not copy metadata unless withMetadata()/keepMetadata() is called, so EXIF/GPS/XMP are gone from here on.
    oriented = await decode().rotate().toColourspace("srgb").png({ compressionLevel: 0 }).toBuffer({ resolveWithObject: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/pixel limit/i.test(msg)) throw new AppError("VALIDATION", "image_too_large");
    throw new AppError("VALIDATION", "unsupported_image_type");
  }
  const { width } = oriented.info;
  const base = () => sharp(oriented.data);

  const renditions = await Promise.all(
    renditionWidths(width).map(async (w) => {
      const { data, info } = await base()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data };
    }),
  );

  const lqip = await base().resize({ width: PLACEHOLDER_WIDTH }).blur(0.6).webp({ quality: 40 }).toBuffer();
  const { dominant } = await base().stats();

  return {
    width: renditions[renditions.length - 1]!.width,
    height: renditions[renditions.length - 1]!.height,
    renditions,
    placeholder: `data:image/webp;base64,${lqip.toString("base64")}`,
    dominantColor: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  };
}

/** Anything with a `put` — the StorageAdapter interface from ./index.ts (kept structural so this file stays pure). */
export type ImageSink = { put(key: string, body: Uint8Array, contentType: string): Promise<{ key: string; url: string }> };

export type StoredImage = {
  /** Default rendition URL (closest to 1024 px) — for OG/WhatsApp/non-responsive consumers. */
  url: string;
  /** Default rendition's storage key. */
  storageKey: string;
  width: number;
  height: number;
  placeholder: string;
  dominantColor: string;
  renditions: ImageRendition[];
};

/** Key layout: stores/<storeId>/<imageId>-<width>.webp — one prefix per store, one id per upload. */
export function renditionKey(storeId: string, imageId: string, width: number) {
  return `stores/${storeId}/${imageId}-${width}.webp`;
}
export const RENDITION_KEY_RE = /^stores\/[0-9a-f-]{36}\/[0-9a-f-]{36}-\d{2,5}\.webp$/;

/**
 * Widths the current pipeline would emit for an image whose largest stored rendition is `topWidth` px but that
 * are missing from `existing` — older uploads predate a width (e.g. 480). Never above the stored top width.
 */
export function missingRenditionWidths(existing: readonly number[], targets: readonly number[] = RENDITION_WIDTHS): number[] {
  if (!existing.length) return [];
  const top = Math.max(...existing);
  const have = new Set(existing);
  return renditionWidths(top, targets).filter((w) => w < top && !have.has(w));
}

/** imageId from a pipeline key (stores/<storeId>/<imageId>-<width>.webp); null for seed/legacy keys. */
export function parseRenditionKey(key: string): { storeId: string; imageId: string; width: number } | null {
  if (!RENDITION_KEY_RE.test(key)) return null;
  const m = /^stores\/([0-9a-f-]{36})\/([0-9a-f-]{36})-(\d+)\.webp$/.exec(key);
  return m ? { storeId: m[1]!, imageId: m[2]!, width: Number(m[3]) } : null;
}

/**
 * Backfill: resize the largest stored rendition (`source`, WebP bytes) to the missing widths, write them next to
 * the existing files (same store prefix + image id) and return the merged, ascending rendition list.
 * Returns null when nothing is missing, the keys are not pipeline keys (seed/legacy rows are left alone) or the
 * key's store prefix is not `storeId` (never write into another tenant's prefix).
 */
export async function addMissingRenditions(
  sink: ImageSink,
  storeId: string,
  existing: readonly ImageRendition[],
  source: Uint8Array,
  targets: readonly number[] = RENDITION_WIDTHS,
): Promise<ImageRendition[] | null> {
  const missing = missingRenditionWidths(existing.map((r) => r.width), targets);
  if (!missing.length) return null;
  const top = [...existing].sort((a, b) => b.width - a.width)[0]!;
  const parsed = parseRenditionKey(top.key);
  if (!parsed || parsed.storeId !== storeId) return null;
  const added = await Promise.all(
    missing.map(async (w) => {
      const { data, info } = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      const { key, url } = await sink.put(renditionKey(parsed.storeId, parsed.imageId, info.width), new Uint8Array(data), "image/webp");
      return { width: info.width, height: info.height, key, url, bytes: data.byteLength };
    }),
  );
  return [...existing, ...added].sort((a, b) => a.width - b.width);
}

export function pickDefaultRendition<T extends { width: number }>(list: readonly T[], target = DEFAULT_RENDITION_WIDTH): T {
  if (!list.length) throw new Error("no renditions");
  const atLeast = list.filter((r) => r.width >= target);
  return atLeast.length ? atLeast[0]! : list[list.length - 1]!;
}

export async function storeImage(sink: ImageSink, storeId: string, input: Uint8Array, opts: { maxMb: number }): Promise<StoredImage> {
  const img = await processImage(input, opts);
  const id = randomUUID();
  const renditions: ImageRendition[] = await Promise.all(
    img.renditions.map(async (r) => {
      const { key, url } = await sink.put(renditionKey(storeId, id, r.width), new Uint8Array(r.data), "image/webp");
      return { width: r.width, height: r.height, key, url, bytes: r.data.byteLength };
    }),
  );
  const def = pickDefaultRendition(renditions);
  return {
    url: def.url,
    storageKey: def.key,
    width: img.width,
    height: img.height,
    placeholder: img.placeholder,
    dominantColor: img.dominantColor,
    renditions,
  };
}
