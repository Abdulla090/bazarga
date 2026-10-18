/**
 * Product Studio (SF9) local photo cleanup: pure pixel functions on RGBA buffers, run in the seller's browser (free,
 * no upload of the original, works offline). The optional remove.bg provider (REMOVE_BG_API_KEY) replaces step 1 with
 * a real cut-out; everything else is the same.
 *
 *   1. whitenBackground: edge-aware flood-fill from the photo's edges (stops at the product outline) → pure white,
 *      with a soft ramp so the product edge is not jagged.
 *   2. autoCropBox: the box around everything that is not background, padded, kept inside the image.
 *   3. enhance: brightness/contrast (+ a little saturation) for dull phone photos.
 */
export type Rgba = { data: Uint8ClampedArray; width: number; height: number };
export type Box = { x: number; y: number; w: number; h: number };

export type StudioOptions = { whiten: boolean; crop: boolean; enhance: boolean; brightness: number; contrast: number };
export const DEFAULT_STUDIO: StudioOptions = { whiten: true, crop: true, enhance: true, brightness: 8, contrast: 12 };

const dist = (d: Uint8ClampedArray, i: number, c: readonly [number, number, number]) =>
  Math.max(Math.abs(d[i]! - c[0]), Math.abs(d[i + 1]! - c[1]), Math.abs(d[i + 2]! - c[2]));

/** Median colour of the outer 2% frame: the backdrop the product was shot on. */
export function edgeColor(img: Rgba): [number, number, number] {
  const { data, width: w, height: h } = img;
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.02));
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const step = Math.max(1, Math.floor((w + h) / 400));
  const push = (x: number, y: number) => { const i = (y * w + x) * 4; rs.push(data[i]!); gs.push(data[i + 1]!); bs.push(data[i + 2]!); };
  for (let x = 0; x < w; x += step) for (let b = 0; b < band; b++) { push(x, b); push(x, h - 1 - b); }
  for (let y = 0; y < h; y += step) for (let b = 0; b < band; b++) { push(b, y); push(w - 1 - b, y); }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[a.length >> 1] ?? 255; };
  return [med(rs), med(gs), med(bs)];
}

/** 3×3 box blur of the RGB channels: takes the JPEG noise out before the edge-aware fill compares neighbours. */
function blurRgb(img: Rgba): Uint8ClampedArray {
  const { data, width: w, height: h } = img;
  const out = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue;
        const i = (yy * w + xx) * 4; r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++; } }
    const o = (y * w + x) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  return out;
}

/**
 * Background mask: 1 for backdrop pixels, grown from the photo's border over pixels within `tol` of the backdrop colour.
 * Edge-aware: the fill never crosses an outline (Sobel edge on the blurred photo above `edge`, thickened by a pixel to
 * close hairline gaps), so it stops at the product even when the product is almost the backdrop's colour (beige tote on
 * a beige wall), while a smooth backdrop gradient or soft floor shadow is still taken. Connected-only, so a white shirt
 * in the middle of a white backdrop keeps its inner detail.
 * Runs at ≤ MASK_SIDE px (edges are scale-dependent), then maps back to full size; pixels on the outline only count
 * as backdrop when their own colour is close to the backdrop, so the edge stays crisp.
 */
function maskAtScale(img: Rgba, tol: number, bg: readonly [number, number, number], edge: number): Uint8Array {
  const { width: w, height: h } = img;
  const c = blurRgb(img);
  const n = w * h;
  // Sobel per colour channel (max of the three): a product that differs from the backdrop only in hue still has an outline.
  const wall = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    let g = 0;
    for (let ch = 0; ch < 3; ch++) {
      const v = (q: number) => c[q * 3 + ch]!;
      const gx = v(p - w + 1) + 2 * v(p + 1) + v(p + w + 1) - v(p - w - 1) - 2 * v(p - 1) - v(p + w - 1);
      const gy = v(p + w - 1) + 2 * v(p + w) + v(p + w + 1) - v(p - w - 1) - 2 * v(p - w) - v(p - w + 1);
      g = Math.max(g, Math.abs(gx) + Math.abs(gy));
    }
    if (g > edge * 4) wall[p] = 1;
  }
  const thick = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (wall[p]) {
    const x = p % w;
    thick[p] = 1;
    if (x > 0) thick[p - 1] = 1;
    if (x < w - 1) thick[p + 1] = 1;
    if (p >= w) thick[p - w] = 1;
    if (p < n - w) thick[p + w] = 1;
  }
  const near = (p: number) => Math.max(Math.abs(c[p * 3]! - bg[0]), Math.abs(c[p * 3 + 1]! - bg[1]), Math.abs(c[p * 3 + 2]! - bg[2]));
  const mask = new Uint8Array(n);
  const stack: number[] = [];
  const tryPush = (p: number) => { if (!mask[p] && !thick[p] && near(p) <= tol) { mask[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { tryPush(x); tryPush((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { tryPush(y * w); tryPush(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) tryPush(p - 1);
    if (x < w - 1) tryPush(p + 1);
    if (p >= w) tryPush(p - w);
    if (p < n - w) tryPush(p + w);
  }
  // The outline walls are a few pixels thick (blur + Sobel + thickening): grow the backdrop back into them, a pixel per
  // pass, wherever the pixel's own colour is close to the backdrop, so no ring of the old backdrop is left around the product.
  const raw = img.data;
  const rawNear = (p: number) => Math.max(Math.abs(raw[p * 4]! - bg[0]), Math.abs(raw[p * 4 + 1]! - bg[1]), Math.abs(raw[p * 4 + 2]! - bg[2]));
  for (let pass = 0; pass < 3; pass++) {
    const add: number[] = [];
    for (let p = 0; p < n; p++) {
      if (mask[p] || rawNear(p) > tol / 2) continue;
      const x = p % w;
      if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (p >= w && mask[p - w]) || (p < n - w && mask[p + w])) add.push(p);
    }
    if (!add.length) break;
    for (const p of add) mask[p] = 1;
  }
  return mask;
}

const MASK_SIDE = 480;

/** Box-downscale so the longer side is ≤ `side` (the mask's working size). */
function downscale(img: Rgba, side: number): { small: Rgba; k: number } {
  const k = Math.max(1, Math.ceil(Math.max(img.width, img.height) / side));
  if (k === 1) return { small: img, k };
  const w = Math.ceil(img.width / k), h = Math.ceil(img.height / k);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y * k; yy < Math.min(img.height, (y + 1) * k); yy++) for (let xx = x * k; xx < Math.min(img.width, (x + 1) * k); xx++) {
      const i = (yy * img.width + xx) * 4; r += img.data[i]!; g += img.data[i + 1]!; b += img.data[i + 2]!; n++;
    }
    const o = (y * w + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  return { small: { data: out, width: w, height: h }, k };
}

export function backgroundMask(img: Rgba, tol = 56, bg = edgeColor(img), edge = 4): Uint8Array {
  const { small, k } = downscale(img, MASK_SIDE);
  const sm = maskAtScale(small, tol, bg, edge);
  if (k === 1) return sm;
  const { data, width: w, height: h } = img;
  const sw = small.width, sh = small.height;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor(y / k));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor(x / k));
      const sp = sy * sw + sx;
      if (!sm[sp]) continue;
      const border = (sx > 0 && !sm[sp - 1]) || (sx < sw - 1 && !sm[sp + 1]) || (sy > 0 && !sm[sp - sw]) || (sy < sh - 1 && !sm[sp + sw]);
      const p = y * w + x;
      if (border && dist(data, p * 4, bg) > 16) continue;
      mask[p] = 1;
    }
  }
  return mask;
}

/** Paint the background white in place. Pixels next to the product get a 50% blend so the edge stays smooth. */
export function whitenBackground(img: Rgba, mask: Uint8Array): void {
  const { data, width: w, height: h } = img;
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    const x = p % w;
    const edge = (x > 0 && !mask[p - 1]) || (x < w - 1 && !mask[p + 1]) || (p >= w && !mask[p - w]) || (p < w * (h - 1) && !mask[p + w]);
    const i = p * 4;
    const k = edge ? 0.5 : 1;
    data[i] = data[i]! + (255 - data[i]!) * k;
    data[i + 1] = data[i + 1]! + (255 - data[i + 1]!) * k;
    data[i + 2] = data[i + 2]! + (255 - data[i + 2]!) * k;
    data[i + 3] = 255;
  }
}

/** Box around the non-background pixels, padded by `pad` (fraction of the larger side); whole image when nothing found. */
export function autoCropBox(mask: Uint8Array, width: number, height: number, pad = 0.06): Box {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  const p = Math.round(Math.max(x1 - x0, y1 - y0) * pad);
  const x = Math.max(0, x0 - p), y = Math.max(0, y0 - p);
  return { x, y, w: Math.min(width, x1 + p + 1) - x, h: Math.min(height, y1 + p + 1) - y };
}

/** Brightness (-50…50) and contrast (-50…50) in place; alpha untouched. */
export function enhance(img: Rgba, brightness: number, contrast: number): void {
  const b = Math.max(-50, Math.min(50, brightness)) * 2.55;
  const c = Math.max(-50, Math.min(50, contrast)) * 2.55;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = f * (d[i]! - 128) + 128 + b;
    d[i + 1] = f * (d[i + 1]! - 128) + 128 + b;
    d[i + 2] = f * (d[i + 2]! - 128) + 128 + b;
  }
}

/** Copy a box out of an image (crop). */
export function cropRgba(img: Rgba, box: Box): Rgba {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const src = ((box.y + y) * img.width + box.x) * 4;
    out.set(img.data.subarray(src, src + box.w * 4), y * box.w * 4);
  }
  return { data: out, width: box.w, height: box.h };
}

/** The whole local pipeline. Returns a new image; the input is not modified. */
export function runStudio(input: Rgba, o: StudioOptions): Rgba {
  let img: Rgba = { data: new Uint8ClampedArray(input.data), width: input.width, height: input.height };
  const mask = o.whiten || o.crop ? backgroundMask(img) : null;
  if (o.whiten && mask) whitenBackground(img, mask);
  if (o.crop && mask) img = cropRgba(img, autoCropBox(mask, img.width, img.height));
  if (o.enhance) enhance(img, o.brightness, o.contrast);
  return img;
}
