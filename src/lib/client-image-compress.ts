/**
 * Browser-side pre-compression for seller uploads (product photos, store cover).
 *
 * Phone cameras produce 3–12 MB, 4000 px JPEGs. Sending those over Iraqi mobile data is slow and costly, and
 * anything above ~4.5 MB is cut off by Vercel's request body limit before it reaches /api/uploads. So before
 * uploading we decode the photo in the browser, downscale it to a longest side of MAX_CLIENT_EDGE and re-encode
 * it as WebP (JPEG where canvas WebP encoding is missing, e.g. Safari < 17). The server pipeline
 * (src/server/storage/pipeline.ts) still validates, strips metadata and produces the final renditions — this is
 * only a transport optimisation, so on any failure the original file is sent unchanged.
 *
 * The size math is pure and unit-tested (tests/client-image-compress.test.ts); the canvas part is not run in tests.
 */

/** Longest side sent to the server. The largest stored rendition is 1280 w, so 2048 leaves room for crops/zoom. */
export const MAX_CLIENT_EDGE = 2048;
export const CLIENT_WEBP_QUALITY = 0.85;
/** Files already at or under this size and edge are sent as-is (re-encoding would only lose quality). */
export const SKIP_BELOW_BYTES = 400 * 1024;

export type Size = { width: number; height: number };

/** Output dimensions: scale the longest side down to `maxEdge`, keep the aspect ratio, never upscale. */
export function targetSize(width: number, height: number, maxEdge = MAX_CLIENT_EDGE): Size & { scale: number } {
  if (!(width > 0 && height > 0)) throw new Error(`Invalid size: ${width}×${height}`);
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / longest;
  return {
    width: width >= height ? maxEdge : Math.max(1, Math.round(width * scale)),
    height: height > width ? maxEdge : Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/** Whether a decoded image is worth re-encoding before upload. */
export function needsCompression(size: Size, bytes: number, maxEdge = MAX_CLIENT_EDGE): boolean {
  return Math.max(size.width, size.height) > maxEdge || bytes > SKIP_BELOW_BYTES;
}

/** Keep the re-encoded blob only when it is actually smaller (a tiny, well-compressed original can grow). */
export function pickSmaller<T extends { size: number }>(original: T, encoded: T | null): T {
  return encoded && encoded.size > 0 && encoded.size < original.size ? encoded : original;
}

/** "IMG_1234.HEIC.jpg" + image/webp → "IMG_1234.HEIC.webp" (only the last extension is replaced). */
export function renamedFor(name: string, type: string): string {
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  const base = name.replace(/\.[a-z0-9]{1,5}$/i, "") || "photo";
  return `${base}.${ext}`;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function encode(canvas: AnyCanvas, type: string, quality: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality }).catch(() => null);
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality));
}

function draw(bitmap: ImageBitmap, size: Size, background?: string): AnyCanvas | null {
  const canvas = makeCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return canvas;
}

/**
 * Downscale + re-encode `file` for upload. Returns the original file when the browser cannot decode/encode it,
 * when it is already small, or when re-encoding would not make it smaller.
 */
export async function compressForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let bitmap: ImageBitmap | undefined;
  try {
    // imageOrientation "from-image" applies the EXIF rotation, so the server receives an upright photo.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (!needsCompression(bitmap, file.size)) return file;
    const size = targetSize(bitmap.width, bitmap.height);
    const canvas = draw(bitmap, size);
    if (!canvas) return file;
    let blob = await encode(canvas, "image/webp", CLIENT_WEBP_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      // No WebP encoder (canvas silently returns PNG): fall back to JPEG on white (JPEG has no alpha).
      const flat = draw(bitmap, size, "#ffffff");
      blob = flat ? await encode(flat, "image/jpeg", CLIENT_WEBP_QUALITY) : null;
      if (blob && blob.type !== "image/jpeg") blob = null;
    }
    const best = pickSmaller<Blob>(file, blob);
    return best === file ? file : new File([best], renamedFor(file.name, best.type), { type: best.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
