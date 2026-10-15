/**
 * Per-product share images (docs/SOCIAL-FIRST.md S3), drawn client-side on a <canvas>: 9:16 story (1080×1920) and
 * 1:1 post (1080×1080) with the product photo, name, price in IQD, store name, a QR code to the product link
 * (`?src=qr`) and a small Bazarga mark. No server rendering, no paid or heavy deps: the QR path comes precomputed
 * from the server (uqr, MIT) and is filled with Path2D.
 *
 * Kurdish / Arabic: text is drawn with `ctx.direction = "rtl"` so the browser's shaper joins letters and orders
 * mixed runs (Latin digits inside Sorani) correctly; "start"-aligned text is anchored on the right edge.
 */
import { formatIQD } from "./money";
import { SHARE_FORMATS, type CaptionLocale, type ShareFormat } from "./social";

export type ShareImageInput = {
  format: ShareFormat;
  locale: CaptionLocale;
  name: string;
  price: number;
  store: string;
  /** Printed under the QR, e.g. "bazarga.vercel.app/s/hawler-bazaar". */
  displayUrl: string;
  qr: { size: number; path: string };
  photo: CanvasImageSource | null;
  /** CSS font-family stack (the page's Vazirmatn/Inter stack). */
  font: string;
};

export const IMAGE_TEXT: Record<CaptionLocale, { scan: string; cod: string; order: string; made: string }> = {
  ku: { scan: "سکان بکە بۆ داواکردن", cod: "پارە لە کاتی گەیاندندا", order: "داواکاری ئۆنلاین، بێ DM", made: "دروستکراوە بە" },
  ar: { scan: "امسح الرمز للطلب", cod: "الدفع عند الاستلام", order: "اطلب أونلاين بدون رسائل", made: "صُنع بواسطة" },
  en: { scan: "Scan to order", cod: "Cash on delivery", order: "Order online, no DMs", made: "Made with" },
};

const INK = "#0a0a0b";
const INK70 = "#3f4654";
const INK50 = "#6b7480";
const BLUE = "#2563eb";
const PAPER = "#f6f8fc";

export const dirFor = (l: CaptionLocale): "rtl" | "ltr" => (l === "en" ? "ltr" : "rtl");

/** x where "start"-aligned text begins for a box [left, left+width] in `dir`. */
export function startX(dir: "rtl" | "ltr", left: number, width: number): number {
  return dir === "rtl" ? left + width : left;
}

/**
 * Greedy word wrap to at most `maxLines` lines no wider than `maxWidth`; the last line gets "…" when text is cut.
 * `measure` is ctx.measureText(...).width, so shaping (joined Arabic-script glyphs) is accounted for.
 */
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]!;
    if (measure(next) <= maxWidth || !cur) {
      cur = next;
      continue;
    }
    lines.push(cur);
    cur = words[i]!;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) {
    lines.push(cur);
    cur = "";
    i = words.length;
  }
  const cut = i < words.length;
  if (lines.length) {
    let last = lines[lines.length - 1]!;
    // A single over-long word, or more words left over: trim and add an ellipsis.
    if (cut || measure(last) > maxWidth) {
      while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
      lines[lines.length - 1] = `${last}…`;
    }
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** object-fit: cover of `img` into the box, clipped to a rounded rect. */
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource | null, x: number, y: number, w: number, h: number, r: number, initial: string, font: string) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const iw = img ? Number((img as HTMLImageElement).naturalWidth || (img as { width?: number }).width || 0) : 0;
  const ih = img ? Number((img as HTMLImageElement).naturalHeight || (img as { height?: number }).height || 0) : 0;
  if (img && iw > 0 && ih > 0) {
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#dbeafe");
    g.addColorStop(1, "#93c5fd");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 ${Math.round(h * 0.32)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

/** QR on a white tile with the 4-module quiet zone, `px` square. */
function drawQr(ctx: CanvasRenderingContext2D, qr: ShareImageInput["qr"], x: number, y: number, px: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, px, px);
  const n = qr.size + 8;
  const m = px / n;
  ctx.save();
  ctx.translate(x + 4 * m, y + 4 * m);
  ctx.scale(m, m);
  ctx.fillStyle = INK;
  if (typeof Path2D !== "undefined") ctx.fill(new Path2D(qr.path));
  ctx.restore();
}

/** Small Bazarga mark: blue rounded tile with a "b" and the word, Latin, always LTR. */
function drawMark(ctx: CanvasRenderingContext2D, cx: number, y: number, size: number, font: string, made: string, dir: "rtl" | "ltr", color = INK50) {
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `500 ${size}px ${font}`;
  ctx.direction = dir;
  const madeW = ctx.measureText(made).width;
  ctx.direction = "ltr";
  ctx.font = `700 ${size}px ${font}`;
  const wordW = ctx.measureText("Bazarga").width;
  const tile = size * 1.25;
  const gap = size * 0.4;
  const total = madeW + gap + tile + gap * 0.6 + wordW;
  // Reading order: "Made with [b] Bazarga" (LTR) / "[b] Bazarga  دروستکراوە بە" (RTL, phrase on the right).
  let x = cx - total / 2;
  const drawBrand = (bx: number) => {
    ctx.fillStyle = BLUE;
    roundRect(ctx, bx, y - tile / 2, tile, tile, tile * 0.28);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${size * 0.95}px ${font}`;
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText("b", bx + tile / 2, y + size * 0.04);
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px ${font}`;
    ctx.textAlign = "left";
    ctx.fillText("Bazarga", bx + tile + gap * 0.6, y);
  };
  ctx.fillStyle = color;
  if (dir === "ltr") {
    ctx.font = `500 ${size}px ${font}`;
    ctx.textAlign = "left";
    ctx.fillText(made, x, y);
    drawBrand(x + madeW + gap);
  } else {
    drawBrand(x);
    x += tile + gap * 0.6 + wordW + gap;
    ctx.font = `500 ${size}px ${font}`;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.fillText(made, x + madeW, y);
  }
  ctx.restore();
}

/** Blue price pill anchored at the reading start; returns its height. */
function drawPrice(ctx: CanvasRenderingContext2D, text: string, dir: "rtl" | "ltr", anchorX: number, y: number, size: number, font: string): number {
  ctx.save();
  ctx.font = `800 ${size}px ${font}`;
  ctx.direction = dir;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.6;
  const x = dir === "rtl" ? anchorX - w : anchorX;
  ctx.fillStyle = BLUE;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + size * 0.04);
  ctx.restore();
  return h;
}

function setText(ctx: CanvasRenderingContext2D, weight: number, size: number, font: string, dir: "rtl" | "ltr", color: string) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.direction = dir;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
}

/** Draws the whole image into `ctx` (which must be SHARE_FORMATS[format] in size). */
export function drawShareImage(ctx: CanvasRenderingContext2D, p: ShareImageInput): void {
  const { w: W, h: H } = SHARE_FORMATS[p.format];
  const dir = dirFor(p.locale);
  const tx = IMAGE_TEXT[p.locale];
  const price = formatIQD(p.price, p.locale);
  const initial = Array.from(p.name.trim())[0] ?? "B";
  ctx.clearRect(0, 0, W, H);

  if (p.format === "story") {
    const pad = 72;
    const inner = W - pad * 2;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    // store name
    setText(ctx, 700, 46, p.font, dir, INK);
    const storeLine = wrapLines((s) => ctx.measureText(s).width, p.store, inner, 1)[0] ?? "";
    ctx.fillText(storeLine, startX(dir, pad, inner), 132);
    setText(ctx, 500, 32, p.font, dir, INK50);
    ctx.fillText(tx.order, startX(dir, pad, inner), 182);
    // photo
    const photoY = 230;
    const photoH = 820;
    ctx.save();
    ctx.shadowColor = "rgba(10,10,11,0.16)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = "#fff";
    roundRect(ctx, pad, photoY, inner, photoH, 44);
    ctx.fill();
    ctx.restore();
    drawCover(ctx, p.photo, pad, photoY, inner, photoH, 44, initial, p.font);
    // name (≤2 lines) + price
    setText(ctx, 800, 76, p.font, dir, INK);
    const lines = wrapLines((s) => ctx.measureText(s).width, p.name, inner, 2);
    let y = photoY + photoH + 118;
    for (const l of lines) {
      ctx.fillText(l, startX(dir, pad, inner), y);
      y += 92;
    }
    drawPrice(ctx, price, dir, startX(dir, pad, inner), y - 40, 58, p.font);
    // QR card
    const cardH = 330;
    const cardY = H - 150 - cardH;
    ctx.save();
    ctx.shadowColor = "rgba(10,10,11,0.10)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#fff";
    roundRect(ctx, pad, cardY, inner, cardH, 36);
    ctx.fill();
    ctx.restore();
    const qrPx = 270;
    const qrX = dir === "rtl" ? pad + 30 : pad + inner - 30 - qrPx;
    drawQr(ctx, p.qr, qrX, cardY + 30, qrPx);
    const textW = inner - qrPx - 100;
    const tx0 = dir === "rtl" ? pad + inner - 40 - textW : pad + 40;
    setText(ctx, 800, 48, p.font, dir, INK);
    ctx.fillText(wrapLines((s) => ctx.measureText(s).width, tx.scan, textW, 1)[0] ?? "", startX(dir, tx0, textW), cardY + 108);
    setText(ctx, 600, 36, p.font, dir, BLUE);
    ctx.fillText(wrapLines((s) => ctx.measureText(s).width, tx.cod, textW, 1)[0] ?? "", startX(dir, tx0, textW), cardY + 170);
    setText(ctx, 500, 28, p.font, "ltr", INK70);
    ctx.textAlign = dir === "rtl" ? "right" : "left";
    ctx.fillText(wrapLines((s) => ctx.measureText(s).width, p.displayUrl, textW, 1)[0] ?? "", dir === "rtl" ? tx0 + textW : tx0, cardY + 248);
    drawMark(ctx, W / 2, H - 82, 30, p.font, tx.made, dir);
    return;
  }

  // square: full-bleed photo, ink gradient at the bottom, name + price, QR tile in the end corner.
  drawCover(ctx, p.photo, 0, 0, W, H, 0, initial, p.font);
  const g = ctx.createLinearGradient(0, H * 0.42, 0, H);
  g.addColorStop(0, "rgba(10,10,11,0)");
  g.addColorStop(0.55, "rgba(10,10,11,0.62)");
  g.addColorStop(1, "rgba(10,10,11,0.88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const pad = 60;
  // store chip (top start)
  ctx.save();
  ctx.font = `700 34px ${p.font}`;
  ctx.direction = dir;
  const chipText = wrapLines((s) => ctx.measureText(s).width, p.store, W - pad * 2 - 60, 1)[0] ?? "";
  const chipW = ctx.measureText(chipText).width + 56;
  const chipX = dir === "rtl" ? W - pad - chipW : pad;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  roundRect(ctx, chipX, pad, chipW, 68, 34);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(chipText, chipX + chipW / 2, pad + 36);
  ctx.restore();
  // QR tile (bottom end)
  const qrPx = 220;
  const qrX = dir === "rtl" ? pad : W - pad - qrPx;
  const qrY = H - pad - qrPx - 40;
  ctx.save();
  ctx.fillStyle = "#fff";
  roundRect(ctx, qrX - 12, qrY - 12, qrPx + 24, qrPx + 64, 24);
  ctx.fill();
  ctx.restore();
  drawQr(ctx, p.qr, qrX, qrY, qrPx);
  ctx.save();
  ctx.font = `700 24px ${p.font}`;
  ctx.direction = dir;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(wrapLines((s) => ctx.measureText(s).width, tx.scan, qrPx, 1)[0] ?? "", qrX + qrPx / 2, qrY + qrPx + 26);
  ctx.restore();
  // name + price (bottom start, beside the QR)
  const textW = W - pad * 2 - qrPx - 48;
  const left = dir === "rtl" ? W - pad - textW : pad;
  setText(ctx, 800, 64, p.font, dir, "#ffffff");
  const lines = wrapLines((s) => ctx.measureText(s).width, p.name, textW, 2);
  const priceH = 58 * 1.6;
  let y = H - pad - priceH - 34 - (lines.length - 1) * 78 - 20;
  for (const l of lines) {
    ctx.fillText(l, startX(dir, left, textW), y);
    y += 78;
  }
  drawPrice(ctx, price, dir, startX(dir, left, textW), y - 44, 50, p.font);
  drawMark(ctx, dir === "rtl" ? W - pad - 120 : pad + 120, H - 34, 22, p.font, tx.made, dir, "rgba(255,255,255,0.78)");
}
