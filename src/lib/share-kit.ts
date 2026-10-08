/**
 * Share kit (dashboard → Share): bio link, QR code, Instagram story image. Pure helpers, no I/O.
 * The QR encoder is `uqr` (MIT, zero deps, ~80 KB unpacked) and only ever runs on the server, so it adds
 * nothing to any client bundle.
 */
import { encode } from "uqr";
import { isLocale, type Locale } from "./i18n";

/** The public storefront URL, same shape the dashboard has always shown: `${APP_URL}/s/<slug>`. */
export function storeUrl(appUrl: string, slug: string): string {
  return `${appUrl.replace(/\/+$/, "")}/s/${encodeURIComponent(slug)}`;
}

/** "https://mymarket.app/s/x" → "mymarket.app/s/x" for printing on images (shorter, still typeable). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export type QrMatrix = { size: number; data: boolean[][] };

/** QR modules for `text` (ECC level M: survives a sticker scratch or a logo-free reprint). No quiet zone. */
export function qrMatrix(text: string): QrMatrix {
  const r = encode(text, { ecc: "M", border: 0 });
  return { size: r.size, data: r.data };
}

/**
 * One SVG path for all dark modules, horizontal runs merged ("M x y h n v1 h-n z"), in module units.
 * Kept tiny so the page can inline it and the PNG/story renderers can rasterise it.
 */
export function qrPath(m: QrMatrix, offset = 0): string {
  let d = "";
  for (let y = 0; y < m.size; y++) {
    const row = m.data[y]!;
    let x = 0;
    while (x < m.size) {
      if (!row[x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < m.size && row[x + run]) run++;
      d += `M${x + offset} ${y + offset}h${run}v1h${-run}z`;
      x += run;
    }
  }
  return d;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Standalone SVG with a 4-module quiet zone (the spec minimum). Colours must be #RRGGBB. */
export function qrSvg(text: string, opts: { fg?: string; bg?: string; px?: number } = {}): string {
  const fg = opts.fg && HEX.test(opts.fg) ? opts.fg : "#000000";
  const bg = opts.bg && HEX.test(opts.bg) ? opts.bg : "#ffffff";
  const m = qrMatrix(text);
  const quiet = 4;
  const n = m.size + quiet * 2;
  const px = opts.px ?? n * 10;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges">` +
    `<rect width="${n}" height="${n}" fill="${bg}"/>` +
    `<path fill="${fg}" d="${qrPath(m, quiet)}"/>` +
    `</svg>`
  );
}

/** wa.me share link with no recipient: WhatsApp opens the chat picker / status with the text filled in. */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Story image language: an explicit, known `lang` wins; otherwise the store's own language. */
export function storyLocale(requested: string | null | undefined, fallback: Locale): Locale {
  return isLocale(requested) ? requested : fallback;
}

/** Safe download name: "<slug>-story-ku.png", "<slug>-qr.svg". Slugs are already [a-z0-9-]. */
export function shareFileName(slug: string, kind: "story" | "qr", ext: "png" | "svg", locale?: Locale): string {
  const safe = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "store";
  return `${safe}-${kind}${locale ? `-${locale}` : ""}.${ext}`;
}

/** Story canvas: Instagram/WhatsApp story size (9:16). */
export const STORY_SIZE = { width: 1080, height: 1920 } as const;

/** Escape text for Pango markup (sharp's text renderer). */
export function escapeMarkup(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
