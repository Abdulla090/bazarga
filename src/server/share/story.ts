import "server-only";
import path from "node:path";
import sharp from "sharp";
import { escapeMarkup, qrMatrix, qrPath, STORY_SIZE } from "@/lib/share-kit";
import type { ThemeTokens } from "@/lib/theme";

/**
 * Instagram / WhatsApp story image (1080×1920 PNG) for a store, rendered with sharp (already a dependency):
 * the background and QR are SVG, text goes through Pango + HarfBuzz + FriBidi, so Sorani/Arabic is shaped and
 * laid out right-to-left correctly. Vazirmatn (OFL, Arabic script + Latin) ships as TTF next to this file so the
 * output is identical on a slim Docker image with no system fonts.
 */
const FONT_DIR = path.join(process.cwd(), "src/server/share/fonts");
const FONT = {
  bold: { file: path.join(FONT_DIR, "Vazirmatn-Bold.ttf"), desc: "Vazirmatn Bold" },
  regular: { file: path.join(FONT_DIR, "Vazirmatn-Regular.ttf"), desc: "Vazirmatn" },
} as const;

export type StoryInput = {
  name: string;
  tagline: string;
  /** Full URL encoded in the QR. */
  url: string;
  /** Short URL printed under the QR. */
  printedUrl: string;
  /** Logo image bytes (any format sharp reads); null → monogram. */
  logo: Uint8Array | null;
  theme: Pick<ThemeTokens, "hero" | "onHero" | "accent" | "onAccent">;
  text: { cta: string; scan: string; poweredBy: string };
};

type TextOpts = { weight: keyof typeof FONT; px: number; color: string; width: number; maxHeight?: number; opacity?: number };

/** Renders one block of centred, word-wrapped text; shrinks the size until it fits `maxHeight`. */
async function textBlock(s: string, o: TextOpts): Promise<{ data: Buffer; width: number; height: number }> {
  let px = o.px;
  for (;;) {
    const alpha = o.opacity !== undefined ? ` fgalpha="${Math.round(o.opacity * 100)}%"` : "";
    const { data, info } = await sharp({
      text: {
        text: `<span foreground="${o.color}"${alpha} size="${px * 1024}">${escapeMarkup(s)}</span>`,
        font: FONT[o.weight].desc,
        fontfile: FONT[o.weight].file,
        width: o.width,
        align: "centre",
        wrap: "word-char",
        dpi: 72,
        rgba: true,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (!o.maxHeight || info.height <= o.maxHeight || px <= 28) return { data, width: info.width, height: info.height };
    px = Math.round(px * 0.85);
  }
}

const W = STORY_SIZE.width;
const H = STORY_SIZE.height;
const center = (w: number) => Math.round((W - w) / 2);

function backgroundSvg(t: StoryInput["theme"]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${t.hero}"/>
      <stop offset="1" stop-color="${t.hero}" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${t.hero}"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="${W - 60}" cy="140" r="260" fill="${t.accent}" fill-opacity="0.18"/>
  <circle cx="60" cy="${H - 120}" r="320" fill="${t.accent}" fill-opacity="0.12"/>
</svg>`;
}

function qrCardSvg(url: string, card: number, fg: string): string {
  const m = qrMatrix(url);
  const quiet = 3;
  const n = m.size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${card}" height="${card}" viewBox="0 0 ${card} ${card}">
  <rect width="${card}" height="${card}" rx="48" fill="#ffffff"/>
  <svg x="24" y="24" width="${card - 48}" height="${card - 48}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">
    <path fill="${fg}" d="${qrPath(m, quiet)}"/>
  </svg>
</svg>`;
}

async function logoDisc(logo: Uint8Array | null, size: number, t: StoryInput["theme"], name: string) {
  const ring = 10;
  const inner = size - ring * 2;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}"/></svg>`);
  const base = sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/><circle cx="${size / 2}" cy="${size / 2}" r="${inner / 2}" fill="${t.accent}"/></svg>`),
  );
  let face: Buffer | null = null;
  if (logo) {
    try {
      face = await sharp(logo, { limitInputPixels: 40_000_000 })
        .resize(inner, inner, { fit: "cover" })
        .composite([{ input: mask, blend: "dest-in" }])
        .png()
        .toBuffer();
    } catch {
      face = null; // unreadable logo → monogram
    }
  }
  if (!face) {
    const initial = Array.from(name.trim())[0] ?? "B";
    const m = await textBlock(initial, { weight: "bold", px: Math.round(inner * 0.5), color: t.onAccent, width: inner });
    return base
      .composite([{ input: m.data, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
      .png()
      .toBuffer();
  }
  return base.composite([{ input: face, left: ring, top: ring }]).png().toBuffer();
}

export async function renderStoryPng(input: StoryInput): Promise<Buffer> {
  const t = input.theme;
  const LOGO = 280;
  const CARD = 600;
  const [logo, name, tagline, cta, scan, url, powered] = await Promise.all([
    logoDisc(input.logo, LOGO, t, input.name),
    textBlock(input.name, { weight: "bold", px: 92, color: t.onHero, width: 940, maxHeight: 260 }),
    input.tagline
      ? textBlock(input.tagline, { weight: "regular", px: 46, color: t.onHero, width: 900, maxHeight: 170, opacity: 0.85 })
      : Promise.resolve(null),
    textBlock(input.text.cta, { weight: "bold", px: 50, color: t.onAccent, width: 820, maxHeight: 140 }),
    textBlock(input.text.scan, { weight: "regular", px: 40, color: t.onHero, width: 900, maxHeight: 110, opacity: 0.85 }),
    textBlock(input.printedUrl, { weight: "bold", px: 44, color: t.onHero, width: 980, maxHeight: 130 }),
    textBlock(input.text.poweredBy, { weight: "regular", px: 30, color: t.onHero, width: 900, opacity: 0.6 }),
  ]);

  const layers: sharp.OverlayOptions[] = [];
  let y = 200;
  layers.push({ input: logo, left: center(LOGO), top: y });
  y += LOGO + 56;
  layers.push({ input: name.data, left: center(name.width), top: y });
  y += name.height + 24;
  if (tagline) {
    layers.push({ input: tagline.data, left: center(tagline.width), top: y });
    y += tagline.height;
  }
  y = Math.max(y + 56, 860);

  const pillW = Math.min(cta.width + 120, 940);
  const pillH = cta.height + 56;
  layers.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pillW}" height="${pillH}"><rect width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${t.accent}"/></svg>`),
    left: center(pillW),
    top: y,
  });
  layers.push({ input: cta.data, left: center(cta.width), top: y + 28 });
  y += pillH + 56;

  // QR card stays fully on the canvas even when the name/tagline wrapped to several lines.
  const footer = scan.height + 24 + url.height + 40 + powered.height + 70;
  y = Math.min(y, H - footer - CARD);
  layers.push({ input: Buffer.from(qrCardSvg(input.url, CARD, "#0a0a0b")), left: center(CARD), top: y });
  y += CARD + 28;
  layers.push({ input: scan.data, left: center(scan.width), top: y });
  y += scan.height + 12;
  layers.push({ input: url.data, left: center(url.width), top: y });
  layers.push({ input: powered.data, left: center(powered.width), top: H - powered.height - 70 });

  return sharp(Buffer.from(backgroundSvg(t)))
    .composite(layers)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}
