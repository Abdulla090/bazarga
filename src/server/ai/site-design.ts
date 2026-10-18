import { z } from "zod";
import { AppError } from "../errors";
import { LANGUAGE_NAME, parseJsonText, type TextProvider } from "./text";
import { DESIGN_IDS, type DesignId } from "@/lib/theme-studio/designs";
import { THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";
import { themeSchema, type StoreTheme } from "@/lib/theme-studio/schema";
import { contrast, ensureContrast, mix } from "@/lib/theme-studio/contrast";

/**
 * SF10 AI Website Designer (Max): a few words about the brand (+ an optional vibe) → a complete Theme Studio draft:
 * layout design (any of the 9, including premium Atelier/Pulse), palette, font pair, buttons, cards, header, an
 * announcement line and the hero tagline, both in the store language. The seller previews the draft and publishes or
 * discards it in Theme Studio; nothing goes live from here.
 */
export type DesignLang = "ku" | "kmr" | "ar" | "en";
export const VIBES = ["minimal", "bold", "luxury", "playful", "natural", "classic"] as const;
export type Vibe = (typeof VIBES)[number];

export const siteDesignInputSchema = z.object({
  brief: z.string().trim().min(3, "hint_required").max(300, "hint_required"),
  vibe: z.enum(VIBES).nullish(),
});
export type SiteDesignInput = { brief: string; vibe?: Vibe | null; lang: DesignLang; storeName: string };

const hex = z.string().trim().regex(/^#?[0-9a-fA-F]{6}$/).transform((v) => ("#" + v.replace(/^#/, "")).toUpperCase());
const outSchema = z.object({
  design: z.enum(DESIGN_IDS),
  palette: z.object({ accent: hex, bg: hex, surface: hex.optional(), text: hex }),
  fontPair: z.enum(["sans-clean", "serif-editorial", "rounded-soft", "mono-bold"]),
  buttons: z.object({ shape: z.enum(["square", "rounded", "pill"]), style: z.enum(["solid", "outline", "soft"]) }).partial().default({}),
  cards: z.object({ radius: z.enum(["none", "sm", "md", "lg"]), style: z.enum(["flat", "hairline", "shadow"]), ratio: z.enum(["square", "portrait", "landscape"]) }).partial().default({}),
  background: z.enum(["solid", "gradient", "pattern"]).optional(),
  headerLayout: z.enum(["centered", "split", "minimal"]).optional(),
  headline: z.string().trim().max(200).default(""),
  tagline: z.string().trim().min(1).max(400),
});

/** Which preset each design starts from (its own tokens fill whatever the model leaves out). */
const DESIGN_BASE: Record<DesignId, string> = {
  classic: "ivory", editorial: "editorial", gallery: "gallery", boutique: "boutique", mono: "mono", studio: "studio",
  market: "market", atelier: "atelier", pulse: "pulse",
};

export function siteDesignPrompt(i: SiteDesignInput): { system: string; user: string } {
  return {
    system: `You are a senior brand designer building a small online shop's storefront theme (Kurdistan/Iraq, Instagram and WhatsApp sellers).
Return ONLY JSON with this shape:
{"design":"…","palette":{"accent":"#RRGGBB","bg":"#RRGGBB","surface":"#RRGGBB","text":"#RRGGBB"},"fontPair":"…",
"buttons":{"shape":"square|rounded|pill","style":"solid|outline|soft"},"cards":{"radius":"none|sm|md|lg","style":"flat|hairline|shadow","ratio":"square|portrait|landscape"},
"background":"solid|gradient|pattern","headerLayout":"centered|split|minimal","headline":"…","tagline":"…"}
design is one of: classic (clean all-rounder), editorial (magazine, serif, slow fashion), gallery (big edge-to-edge photos, art, photography),
boutique (soft, rounded, beauty, flowers, gifts), mono (stark black-and-white ledger, streetwear basics), studio (modern tech, bright),
market (dense catalogue, groceries, many cheap products), atelier (premium couture: dark, gold, luxury, perfume, jewellery),
pulse (premium night drop: dark with a neon accent, sneakers, gaming, youth streetwear).
fontPair is one of: sans-clean, serif-editorial, rounded-soft, mono-bold.
Colours: text must be readable on bg (contrast at least 4.5:1); surface is close to bg; accent is the brand colour.
headline: one short announcement-bar line (max 60 characters, no emoji). tagline: the hero line under the store name (max 120 characters), warm and specific to the brand.
Write headline and tagline ONLY in ${LANGUAGE_NAME[i.lang]}. Never invent prices, discounts, addresses or claims the seller didn't give.`,
    user: `Store name: ${i.storeName}\nVibe: ${i.vibe ?? "-"}\nThe seller describes the brand:\n${i.brief}`,
  };
}

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trim();
};

/** Model answer → a valid StoreTheme: unknown fields fall back to the design's preset, colours fixed to readable contrast. */
export function normalizeSiteDesign(raw: unknown, lang: DesignLang): StoreTheme {
  const p = outSchema.safeParse(raw);
  if (!p.success) throw new AppError("UNAVAILABLE", "ai_bad_shape");
  const o = p.data;
  const base = THEME_STUDIO_PRESETS[DESIGN_BASE[o.design]]!;
  const bg = o.palette.bg;
  const text = ensureContrast(o.palette.text, bg, 4.5).color.toUpperCase();
  let surface = (o.palette.surface ?? mix(bg, text, 0.04)).toUpperCase();
  // A surface that reads badly with the text would break cards; pull it back toward the background.
  if (contrast(text, surface) < 4.5) surface = mix(bg, text, 0.04).toUpperCase();
  // Accent carries buttons and links: at least 3:1 against the page so it never vanishes.
  const accent = ensureContrast(o.palette.accent, bg, 3).color.toUpperCase();
  const theme: StoreTheme = {
    v: 1,
    preset: "ai",
    design: o.design,
    colors: { accent, bg, surface, text },
    type: { pair: o.fontPair, scale: base.type.scale },
    buttons: { shape: o.buttons.shape ?? base.buttons.shape, style: o.buttons.style ?? base.buttons.style, size: base.buttons.size },
    cards: { radius: o.cards.radius ?? base.cards.radius, style: o.cards.style ?? base.cards.style, ratio: o.cards.ratio ?? base.cards.ratio },
    background: { kind: o.background ?? base.background.kind },
    header: { layout: o.headerLayout ?? base.header.layout, ...(o.headline ? { announce: clip(o.headline, 80) } : {}) },
    copy: { lang, tagline: clip(o.tagline, 140) },
  };
  return themeSchema.parse(theme);
}

/** Keyword → design for the offline mock (any language the demo seller might type). */
const KEYWORDS: [DesignId, RegExp][] = [
  ["atelier", /luxur|gold|perfume|parfum|jewel|couture|abaya|silk|عطر|ذهب|فاخر|مجوهرات|بۆن|عەتر|زێڕ|bîhn|zêr/i],
  ["pulse", /sneaker|street|gaming|game|neon|tech|gadget|phone|موبايل|حذاء|ألعاب|پێڵاو|یاری|mobîl|pêlav/i],
  ["boutique", /flower|beauty|cosmetic|makeup|gift|candle|soft|ورد|تجميل|هدايا|گوڵ|جوانکاری|دیاری|gul|diyarî/i],
  ["market", /grocer|food|market|snack|spice|bulk|wholesale|طعام|بقالة|بهارات|خواردن|بازاڕ|xwarin|bazar/i],
  ["editorial", /book|coffee|fashion|magazine|vintage|كتب|قهوة|أزياء|کتێب|قاوە|جلوبەرگ|pirtûk|qehwe/i],
  ["gallery", /art|photo|paint|ceramic|craft|handmade|فن|صور|رسم|هونەر|وێنە|destçêkirî|huner/i],
  ["mono", /basic|black|white|minimal|essentials|أسود|ڕەش|reş/i],
];
const VIBE_DESIGN: Record<Vibe, DesignId> = { minimal: "mono", bold: "pulse", luxury: "atelier", playful: "boutique", natural: "editorial", classic: "classic" };
const ACCENTS = ["#2563EB", "#0F766E", "#B42318", "#7C3AED", "#B45309", "#DB2777", "#0891B2", "#15803D"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const MOCK_COPY: Record<DesignLang, { headline: (n: string) => string; tagline: (b: string) => string }> = {
  ku: { headline: (n) => `بەخێربێن بۆ ${n} — گەیاندن بۆ هەموو کوردستان`, tagline: (b) => `${b} — بە وردی هەڵبژێردراوە، بە دڵی تۆ.` },
  kmr: { headline: (n) => `Bi xêr hatî ${n} — şandin li seranserê Kurdistanê`, tagline: (b) => `${b} — bi baldarî hatiye hilbijartin, li gorî dilê te.` },
  ar: { headline: (n) => `أهلاً بكم في ${n} — توصيل لكل المدن`, tagline: (b) => `${b} — مختار بعناية، على ذوقك.` },
  en: { headline: (n) => `Welcome to ${n}: delivery across Kurdistan and Iraq`, tagline: (b) => `${b}, carefully chosen for you.` },
};

/** Deterministic offline design (dev, tests, the demo store): same brief → same theme, no network. */
export function mockSiteDesign(i: SiteDesignInput): StoreTheme {
  const brief = i.brief.replace(/\s+/g, " ").trim();
  const design = KEYWORDS.find(([, re]) => re.test(brief))?.[0] ?? (i.vibe ? VIBE_DESIGN[i.vibe] : (["classic", "editorial", "boutique", "studio", "gallery"] as const)[hash(brief) % 5]!);
  const base = THEME_STUDIO_PRESETS[DESIGN_BASE[design]]!;
  const premium = design === "atelier" || design === "pulse" || design === "mono";
  const accent = premium ? base.colors.accent : ACCENTS[hash(brief + (i.vibe ?? "")) % ACCENTS.length]!;
  const m = MOCK_COPY[i.lang];
  const lead = clip(brief, 70);
  return normalizeSiteDesign(
    {
      design,
      palette: { accent, bg: base.colors.bg, surface: base.colors.surface, text: base.colors.text },
      fontPair: base.type.pair,
      buttons: base.buttons,
      cards: base.cards,
      background: base.background.kind,
      headerLayout: base.header.layout,
      headline: m.headline(i.storeName),
      tagline: m.tagline(lead.charAt(0).toUpperCase() + lead.slice(1)),
    },
    i.lang,
  );
}

export async function generateSiteDesign(provider: TextProvider, input: SiteDesignInput): Promise<StoreTheme> {
  if (provider.name === "mock") return mockSiteDesign(input);
  const { system, user } = siteDesignPrompt(input);
  return normalizeSiteDesign(parseJsonText(await provider.json({ system, user, temperature: 0.8 })), input.lang);
}
