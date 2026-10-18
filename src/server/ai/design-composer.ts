import { z } from "zod";
import { AppError } from "../errors";
import { LANGUAGE_NAME, parseJsonText, type TextProvider } from "./text";
import {
  CARD_VARIANTS, DENSITIES, FOOTER_VARIANTS, GRID_VARIANTS, HEADER_VARIANTS, HERO_VARIANTS, HOME_SECTIONS, MOTIONS, PRODUCT_LAYOUTS, SURFACES, TYPE_PAIRS,
  composeDesign, encodeComposition,
  type CardVariant, type GridVariant, type HeroVariant, type HomeSection, type Surface, type TypePair,
} from "@/lib/theme-studio/designs";
import { FLAGSHIPS, FLAGSHIP_IDS, type FlagshipId } from "@/lib/theme-studio/themes";
import { themeSchema, type StoreTheme } from "@/lib/theme-studio/schema";
import { contrast, ensureContrast, mix } from "@/lib/theme-studio/contrast";
import { encodePreviewTheme } from "@/lib/theme-studio/preview-token";
import { VIBES, type DesignLang, type Vibe } from "./site-design";

/**
 * AI Website Designer v2 (SF10, Max, docs/DESIGN-SYSTEM.md "AI composition"). One generation = one credit = three full
 * designs side by side. Each option is a complete composition, not a palette: a flagship base, every section variant
 * (header, hero, grid, card, product page, footer), density, surface, motion, the home section order, a type pair, a
 * contrast-checked palette and the announcement line + hero tagline in the store language. The composer reads the
 * store's real catalogue (categories, product names, prices, how many have photos, what is on sale) so the options fit
 * the niche: photo-led heroes only when there are photos, a sale section only when something is on sale, dense grids
 * for big catalogues. The seller previews the three as live thumbnails, picks one into the draft, then publishes or
 * discards it in Theme Studio. Nothing goes live from here.
 */
export const OPTION_COUNT = 3;

export type CatalogContext = {
  categories: string[];
  products: { title: string; price: number; onSale: boolean; hasImage: boolean; category?: string | null }[];
  /** Total active products (the sample above is capped). */
  productCount: number;
  hasCover: boolean;
};
export type ComposeInput = { brief: string; vibe?: Vibe | null; lang: DesignLang; storeName: string; catalog: CatalogContext };
export type DesignOption = { id: "a" | "b" | "c"; base: FlagshipId; name: string | null; niche: Niche; theme: StoreTheme; preview: string };

export const composeInputSchema = z.object({
  brief: z.string().trim().min(3, "hint_required").max(300, "hint_required"),
  vibe: z.enum(VIBES).nullish(),
});

// ---------------------------------------------------------------------------------------------------------------------
// Niches: what the catalogue sells decides which flagship bases, variants, type pairs and palettes fit.

export const NICHES = ["luxury", "fashion", "street", "beauty", "food", "home", "kids", "art", "books", "tech", "general"] as const;
export type Niche = (typeof NICHES)[number];

const NICHE_WORDS: Record<Exclude<Niche, "general">, RegExp> = {
  luxury: /luxur|gold|perfume|parfum|fragrance|oud|jewel|couture|silk|watch|diamond|عطر|عود|ذهب|فاخر|مجوهرات|ساعة|بۆن|عەتر|زێڕ|خشڵ|کاتژمێر|bîhn|zêr|xişl/i,
  street: /sneaker|street|hoodie|drop|skate|jordan|cap\b|حذاء رياضي|سنيكر|هودي|پێڵاوی وەرزشی|هوودی|pêlava werzişê|hûdî/i,
  beauty: /beauty|cosmetic|makeup|skin|lipstick|cream|serum|nail|hair|flower|bouquet|gift|candle|تجميل|مكياج|بشرة|ورد|هدايا|شمع|جوانکاری|مکیاج|پێست|گوڵ|دیاری|مۆم|xemil|makyaj|gul|diyarî|mûm/i,
  food: /food|grocer|snack|spice|sweet|cake|bakery|honey|coffee bean|tea|nuts|date|kitchen|طعام|بقالة|بهارات|حلويات|كيك|عسل|شاي|مكسرات|تمر|خواردن|بەهارات|شیرینی|کێک|هەنگوین|چا|خورما|xwarin|şîrînî|hingiv|çay/i,
  home: /home|decor|furniture|ceramic|vase|linen|towel|lamp|rug|carpet|pillow|cushion|منزل|ديكور|أثاث|سجاد|وسادة|ماڵ|دیکۆر|کەلوپەل|ڕایەخ|سەرین|mal|dekor|mobîlya|xalî|balîf/i,
  kids: /kid|child|baby|toy|school|stationery|plush|lego|أطفال|طفل|ألعاب|رضيع|منداڵ|ساوا|یاری|قوتابخانە|zarok|pitik|lîstik|dibistan/i,
  art: /art|photo|print|paint|poster|handmade|craft|pottery|frame|فن|لوحة|رسم|يدوي|هونەر|تابلۆ|وێنە|دەستکرد|huner|tablo|wêne|destçêkirî/i,
  books: /book|novel|magazine|vintage|journal|كتاب|كتب|رواية|مجلة|کتێب|ڕۆمان|گۆڤار|pirtûk|roman|kovar/i,
  tech: /tech|gadget|phone|laptop|charger|cable|headphone|earbud|gaming|console|electronic|موبايل|هاتف|شاحن|سماعة|إلكترون|مۆبایل|شەحن|بیستۆک|ئەلیکترۆن|mobîl|telefon|şarj|elektronîk/i,
  fashion: /fashion|dress|abaya|hijab|shirt|jacket|scarf|bag|shoe|clothing|wear|أزياء|فستان|عباية|حجاب|قميص|حقيبة|ملابس|جلوبەرگ|کراس|عەبا|حیجاب|جانتا|پێڵاو|cil|kiras|çente|pêlav/i,
};

type NicheCfg = {
  bases: FlagshipId[];
  heroes: HeroVariant[];
  grids: GridVariant[];
  cards: CardVariant[];
  surfaces: Surface[];
  pairs: TypePair[];
  /** accent, bg, surface, text — light and dark moods; the normaliser contrast-checks them anyway. */
  palettes: [string, string, string, string][];
  extra: HomeSection[];
};

const NICHE: Record<Niche, NicheCfg> = {
  luxury: {
    bases: ["luxe", "folio", "canvas", "street"], heroes: ["runway", "masthead", "fullbleed", "spotlight"], grids: ["lookbook", "magazine", "tiles"],
    cards: ["frame", "editorial", "tile"], surfaces: ["paper", "flat", "glow"], pairs: ["luxe-serif", "serif-editorial", "grotesk"],
    palettes: [["#B08D57", "#16120F", "#201A16", "#F3EDE4"], ["#1C1915", "#F6F2EA", "#FFFDF8", "#1C1915"], ["#7A1F2B", "#FBF7F2", "#FFFFFF", "#22181A"], ["#C9A86A", "#0E0F12", "#181A1F", "#EDE7DB"]],
    extra: ["story", "spotlight"],
  },
  fashion: {
    bases: ["folio", "canvas", "luxe", "blush"], heroes: ["masthead", "fullbleed", "runway", "split"], grids: ["magazine", "lookbook", "tiles", "auto"],
    cards: ["editorial", "frame", "tile", "classic"], surfaces: ["paper", "flat"], pairs: ["serif-editorial", "luxe-serif", "grotesk", "condensed"],
    palettes: [["#8C2F1B", "#F3EEE4", "#FBF8F2", "#15110D"], ["#111111", "#FFFFFF", "#F4F4F2", "#111111"], ["#2F4B3A", "#F2F0EA", "#FFFFFF", "#1A1F1B"], ["#B4566E", "#FBF3F1", "#FFFFFF", "#3A2A2E"]],
    extra: ["story", "social"],
  },
  street: {
    bases: ["street", "circuit", "canvas", "play"], heroes: ["pulse", "type", "spotlight", "fullbleed"], grids: ["bento", "masonry", "auto"],
    cards: ["glow", "tile", "float"], surfaces: ["blocks", "flat", "glass"], pairs: ["condensed", "mono-bold", "grotesk"],
    palettes: [["#FF3B2F", "#0A0A0A", "#171717", "#F5F5F5"], ["#C6FF00", "#0B0B0D", "#16161A", "#F4F4F5"], ["#2563EB", "#F4F4F5", "#FFFFFF", "#0A0A0B"], ["#FF6B00", "#111111", "#1C1C1C", "#FAFAFA"]],
    extra: ["social", "sale"],
  },
  beauty: {
    bases: ["glow", "blush", "luxe", "folio"], heroes: ["stage", "arch", "runway", "spotlight"], grids: ["masonry", "soft", "lookbook"],
    cards: ["float", "soft", "frame"], surfaces: ["glow", "flat", "paper"], pairs: ["luxe-serif", "rounded-soft", "serif-editorial"],
    palettes: [["#B83A6B", "#FFF6F3", "#FFFFFF", "#2B1B22"], ["#B4566E", "#FBF3F1", "#FFFFFF", "#3A2A2E"], ["#8E5A3C", "#F7EFE8", "#FFFBF7", "#2A1E18"], ["#6D4C9F", "#F7F4FB", "#FFFFFF", "#241B33"]],
    extra: ["social", "spotlight", "whatsapp"],
  },
  food: {
    bases: ["hearth", "bazaar", "blush", "folio"], heroes: ["split", "banner", "stage", "masthead"], grids: ["auto", "dense", "soft"],
    cards: ["classic", "compact", "soft"], surfaces: ["paper", "flat"], pairs: ["serif-editorial", "sans-clean", "rounded-soft"],
    palettes: [["#9A4A2A", "#F6EFE4", "#FFFBF5", "#2A2118"], ["#D92D20", "#F2F3F5", "#FFFFFF", "#101828"], ["#3F6212", "#F5F3E7", "#FFFDF5", "#1F2412"], ["#B45309", "#FFF8EC", "#FFFFFF", "#2B1D0E"]],
    extra: ["whatsapp", "story", "offers"],
  },
  home: {
    bases: ["hearth", "canvas", "folio", "luxe"], heroes: ["split", "fullbleed", "masthead", "arch"], grids: ["auto", "tiles", "magazine", "soft"],
    cards: ["classic", "tile", "editorial", "soft"], surfaces: ["paper", "flat"], pairs: ["serif-editorial", "grotesk", "luxe-serif"],
    palettes: [["#9A4A2A", "#F6EFE4", "#FFFBF5", "#2A2118"], ["#4B5D4A", "#F1EFE8", "#FBFAF6", "#1E231D"], ["#111111", "#FFFFFF", "#F4F4F2", "#111111"], ["#7C5C3B", "#EFE9DF", "#F8F4EC", "#241C14"]],
    extra: ["story", "whatsapp"],
  },
  kids: {
    bases: ["play", "blush", "glow", "bazaar"], heroes: ["play", "stage", "arch", "banner"], grids: ["soft", "masonry", "auto"],
    cards: ["soft", "float", "classic"], surfaces: ["blocks", "flat", "glow"], pairs: ["playful", "rounded-soft"],
    palettes: [["#4338CA", "#FFFBEB", "#FFFFFF", "#1E1B4B"], ["#0E7490", "#F0FDFA", "#FFFFFF", "#0F2A33"], ["#DB2777", "#FFF7FB", "#FFFFFF", "#3B0A24"], ["#EA580C", "#FFF7ED", "#FFFFFF", "#2D1606"]],
    extra: ["whatsapp", "collections"],
  },
  art: {
    bases: ["canvas", "folio", "luxe", "glow"], heroes: ["fullbleed", "masthead", "runway", "type"], grids: ["tiles", "lookbook", "magazine"],
    cards: ["tile", "frame", "editorial"], surfaces: ["flat", "paper"], pairs: ["grotesk", "serif-editorial", "luxe-serif"],
    palettes: [["#111111", "#FFFFFF", "#F4F4F2", "#111111"], ["#C2410C", "#F7F3EE", "#FFFFFF", "#1C1917"], ["#E5E5E5", "#0D0D0D", "#1A1A1A", "#F5F5F5"], ["#1D4ED8", "#F8FAFC", "#FFFFFF", "#0F172A"]],
    extra: ["story", "social"],
  },
  books: {
    bases: ["folio", "hearth", "canvas", "circuit"], heroes: ["masthead", "split", "type", "spotlight"], grids: ["magazine", "rows", "auto"],
    cards: ["editorial", "row", "classic"], surfaces: ["paper", "flat"], pairs: ["serif-editorial", "luxe-serif", "mono-bold"],
    palettes: [["#8C2F1B", "#F3EEE4", "#FBF8F2", "#15110D"], ["#1F4E79", "#F4F1EA", "#FFFDF8", "#14171C"], ["#14532D", "#F5F2E9", "#FFFDF6", "#151A14"], ["#E2B04A", "#121212", "#1C1C1C", "#F2EEE4"]],
    extra: ["story", "spotlight"],
  },
  tech: {
    bases: ["circuit", "street", "bazaar", "canvas"], heroes: ["spotlight", "pulse", "banner", "stage"], grids: ["auto", "bento", "dense", "rows"],
    cards: ["classic", "glow", "compact", "row"], surfaces: ["glass", "blocks", "flat"], pairs: ["tech-mono", "grotesk", "mono-bold"],
    palettes: [["#4F8CFF", "#0B0E14", "#141A24", "#E8EDF5"], ["#22D3EE", "#0A0F14", "#121A22", "#E6F1F7"], ["#2563EB", "#F5F7FA", "#FFFFFF", "#0B1220"], ["#16A34A", "#0B0D0C", "#151816", "#E9F2EC"]],
    extra: ["spotlight", "sale"],
  },
  general: {
    bases: ["hearth", "canvas", "glow", "bazaar"], heroes: ["split", "stage", "fullbleed", "banner"], grids: ["auto", "soft", "masonry"],
    cards: ["classic", "soft", "float"], surfaces: ["flat", "paper", "glow"], pairs: ["sans-clean", "grotesk", "rounded-soft", "serif-editorial"],
    palettes: [["#2563EB", "#FAFAF7", "#FFFFFF", "#0A0A0B"], ["#0F766E", "#F4F6F4", "#FFFFFF", "#10201E"], ["#B42318", "#FBF7F4", "#FFFFFF", "#1F1412"], ["#7C3AED", "#F8F7FC", "#FFFFFF", "#1C1530"]],
    extra: ["whatsapp", "best"],
  },
};

const VIBE_NICHE: Record<Vibe, Niche> = { minimal: "art", bold: "street", luxury: "luxury", playful: "kids", natural: "home", classic: "general" };

/** Photo-led variants: never offered when the catalogue has few photos (they would render as empty frames). */
const PHOTO_HEROES: readonly HeroVariant[] = ["fullbleed", "runway", "spotlight", "arch"];
const PHOTO_GRIDS: readonly GridVariant[] = ["tiles", "lookbook"];
const PHOTO_CARDS: readonly CardVariant[] = ["tile", "frame"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The store's niche: the brief first, then what share of categories and product names match each niche. */
export function detectNiche(brief: string, catalog: CatalogContext, vibe?: Vibe | null): Niche {
  const score = Object.fromEntries(NICHES.map((n) => [n, 0])) as Record<Niche, number>;
  const add = (text: string, w: number) => { for (const [n, re] of Object.entries(NICHE_WORDS)) if (re.test(text)) score[n as Niche] += w; };
  // The seller's own words lead; the catalogue counts by share (a big catalogue can't drown the brief).
  add(brief, 5);
  for (const c of catalog.categories) add(c, 3 / Math.max(1, catalog.categories.length));
  for (const p of catalog.products) add(p.title, 3 / Math.max(1, catalog.products.length));
  if (vibe) score[VIBE_NICHE[vibe]] += 1.5;
  const best = (Object.entries(score) as [Niche, number][]).sort((a, b) => b[1] - a[1])[0]!;
  return best[1] > 0 ? best[0] : "general";
}

/** Facts about the catalogue the composition has to respect. */
export function catalogTraits(c: CatalogContext) {
  const n = c.products.length;
  const withImg = c.products.filter((p) => p.hasImage).length;
  return {
    photoRich: n > 0 ? withImg / n >= 0.5 : c.hasCover,
    hasCover: c.hasCover,
    onSale: c.products.some((p) => p.onSale),
    big: c.productCount >= 30,
    tiny: c.productCount > 0 && c.productCount < 6,
    topCategory: c.categories[0] ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Copy in the store language (mock + fallback). Never prices, discounts or claims the seller didn't give.

const NOUN: Record<Niche, Record<DesignLang, string>> = {
  luxury: { en: "Fine pieces", ku: "پارچەی ناوازە", kmr: "Perçeyên bijarte", ar: "قطع فاخرة" },
  fashion: { en: "Clothes", ku: "جلوبەرگ", kmr: "Cil û berg", ar: "أزياء" },
  street: { en: "Fresh drops", ku: "دابەزینی نوێ", kmr: "Hilberên nû", ar: "إصدارات جديدة" },
  beauty: { en: "Beauty", ku: "جوانکاری", kmr: "Xemil", ar: "منتجات الجمال" },
  food: { en: "Good food", ku: "خواردنی باش", kmr: "Xwarina baş", ar: "أطايب" },
  home: { en: "Things for home", ku: "کەلوپەلی ماڵ", kmr: "Tiştên malê", ar: "مستلزمات البيت" },
  kids: { en: "Toys and treats", ku: "یاری و دیاری", kmr: "Lîstik û diyarî", ar: "ألعاب وهدايا" },
  art: { en: "Art and craft", ku: "هونەر و دەستکرد", kmr: "Huner û destçêkirî", ar: "فن وحِرف" },
  books: { en: "Books", ku: "کتێب", kmr: "Pirtûk", ar: "كتب" },
  tech: { en: "Gadgets", ku: "ئامێرەکان", kmr: "Amûr", ar: "أجهزة" },
  general: { en: "Everyday finds", ku: "کەلوپەلی ڕۆژانە", kmr: "Tiştên rojane", ar: "مختارات يومية" },
};

const TAGLINES: Record<DesignLang, ((noun: string, cat: string, store: string) => string)[]> = {
  en: [(n) => `${n}, chosen one piece at a time.`, (_n, c, s) => `${c} and more from ${s}, picked for you.`, (n, _c, s) => `Discover ${n.toLowerCase()} with character at ${s}.`],
  ku: [(n) => `${n}، یەک بە یەک هەڵبژێردراو.`, (_n, c, s) => `${c} و زیاتر لە ${s}، بۆ تۆ هەڵبژێردراوە.`, (n, _c, s) => `${n}ی جیاواز لە ${s} بدۆزەرەوە.`],
  kmr: [(n) => `${n}, yek bi yek hatine hilbijartin.`, (_n, c, s) => `${c} û bêtir ji ${s}, ji bo te hatine hilbijartin.`, (n, _c, s) => `Li ${s} ${n.toLowerCase()} bi kesayetî kifş bike.`],
  ar: [(n) => `${n}، مختارة قطعةً قطعة.`, (_n, c, s) => `${c} والمزيد من ${s}، اخترناها لك.`, (n, _c, s) => `اكتشف ${n} بطابع مميز في ${s}.`],
};
const HEADLINES: Record<DesignLang, ((store: string, cat: string) => string)[]> = {
  en: [(s) => `Welcome to ${s}`, (_s, c) => `New in: ${c}`, (s) => `${s}: order on WhatsApp in a tap`],
  ku: [(s) => `بەخێربێن بۆ ${s}`, (_s, c) => `نوێ: ${c}`, (s) => `${s}: بە یەک کلیک لە واتسئەپ داوا بکە`],
  kmr: [(s) => `Bi xêr hatî ${s}`, (_s, c) => `Nû: ${c}`, (s) => `${s}: bi yek tikandinê li WhatsAppê ferman bide`],
  ar: [(s) => `أهلاً بكم في ${s}`, (_s, c) => `جديدنا: ${c}`, (s) => `${s}: اطلب عبر واتساب بلمسة`],
};

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trim();
};

// ---------------------------------------------------------------------------------------------------------------------
// Normaliser: any model answer (or mock draft) → three valid, distinct, contrast-checked StoreThemes.

const hex = z.string().trim().regex(/^#?[0-9a-fA-F]{6}$/).transform((v) => ("#" + v.replace(/^#/, "")).toUpperCase());
const loose = <T extends string>(list: readonly T[]) => z.string().optional().transform((v) => ((list as readonly string[]).includes(v ?? "") ? (v as T) : undefined));
const rawOption = z.object({
  base: z.enum(FLAGSHIP_IDS),
  name: z.string().trim().max(40).optional(),
  layout: z
    .object({
      header: loose(HEADER_VARIANTS), hero: loose(HERO_VARIANTS), grid: loose(GRID_VARIANTS), card: loose(CARD_VARIANTS), product: loose(PRODUCT_LAYOUTS),
      footer: loose(FOOTER_VARIANTS), density: loose(DENSITIES), surface: loose(SURFACES), motion: loose(MOTIONS),
      sections: z.array(z.string()).optional(),
    })
    .partial()
    .default({}),
  fontPair: loose(TYPE_PAIRS),
  palette: z.object({ accent: hex, bg: hex, surface: hex.optional(), text: hex }).optional(),
  buttons: z.object({ shape: loose(["square", "rounded", "pill"] as const), style: loose(["solid", "outline", "soft"] as const) }).partial().optional(),
  cards: z.object({ radius: loose(["none", "sm", "md", "lg"] as const), style: loose(["flat", "hairline", "shadow"] as const), ratio: loose(["square", "portrait", "landscape"] as const) }).partial().optional(),
  headline: z.string().trim().max(200).default(""),
  tagline: z.string().trim().max(400).default(""),
});
type RawOption = z.input<typeof rawOption>;

/** One option → a complete theme: base flagship fills every gap, every layout axis written out, colours readable. */
export function normalizeOption(raw: unknown, lang: DesignLang, fallbackCopy: { headline: string; tagline: string }): { base: FlagshipId; name: string | null; theme: StoreTheme } | null {
  const p = rawOption.safeParse(raw);
  if (!p.success) return null;
  const o = p.data;
  const base = FLAGSHIPS[o.base].theme;
  const pal = o.palette ?? { ...base.colors };
  const bg = pal.bg;
  const text = ensureContrast(pal.text, bg, 4.5).color.toUpperCase();
  let surface = (pal.surface ?? mix(bg, text, 0.04)).toUpperCase();
  if (contrast(text, surface) < 4.5) surface = mix(bg, text, 0.04).toUpperCase();
  const accent = ensureContrast(pal.accent, bg, 3).color.toUpperCase();
  const L = o.layout;
  const sections = (L.sections ?? []).filter((s): s is HomeSection => (HOME_SECTIONS as readonly string[]).includes(s));
  const draft = {
    design: base.design,
    type: { pair: o.fontPair ?? base.type.pair },
    header: { layout: L.header ?? base.header.layout },
    layout: {
      ...base.layout,
      ...Object.fromEntries(Object.entries({ header: L.header, hero: L.hero, grid: L.grid, card: L.card, product: L.product, footer: L.footer, density: L.density, surface: L.surface, motion: L.motion }).filter(([, v]) => v)),
      ...(sections.length ? { sections: [...new Set(sections)] } : {}),
    },
  };
  // Write every axis out, so the option is a full composition whatever the model left out.
  const spec = composeDesign(draft);
  const headline = clip(o.headline || fallbackCopy.headline, 80);
  const tagline = clip(o.tagline || fallbackCopy.tagline, 140);
  const theme: StoreTheme = {
    v: 1,
    preset: "ai",
    design: base.design,
    colors: { accent, bg, surface, text },
    type: { pair: spec.type, scale: base.type.scale },
    buttons: { shape: o.buttons?.shape ?? base.buttons.shape, style: o.buttons?.style ?? base.buttons.style, size: base.buttons.size },
    cards: { radius: o.cards?.radius ?? base.cards.radius, style: o.cards?.style ?? base.cards.style, ratio: o.cards?.ratio ?? base.cards.ratio },
    background: { kind: base.background.kind },
    header: { layout: spec.header, ...(headline ? { announce: headline } : {}) },
    layout: { header: spec.header, hero: spec.hero, grid: spec.grid, card: spec.card, footer: spec.footer, product: spec.product, density: spec.density, surface: spec.surface, motion: spec.motion, sections: [...spec.sections] },
    copy: { lang, tagline: tagline || fallbackCopy.tagline.slice(0, 140) },
  };
  const ok = themeSchema.safeParse(theme);
  return ok.success ? { base: o.base, name: o.name ? clip(o.name, 40) : null, theme: ok.data } : null;
}

const fingerprint = (t: StoreTheme) => encodeComposition(composeDesign(t)) + t.colors.bg + t.colors.accent;

/**
 * Model answer → exactly three distinct options. Bad or duplicate options are replaced by the deterministic mock's, so
 * a sloppy answer still gives the seller three real choices; an answer with no usable option at all is an error.
 */
export function normalizeComposition(raw: unknown, input: ComposeInput): DesignOption[] {
  const list = (raw && typeof raw === "object" && Array.isArray((raw as { options?: unknown }).options) ? (raw as { options: unknown[] }).options : []).slice(0, 6);
  const niche = detectNiche(input.brief, input.catalog, input.vibe);
  const fallback = mockDrafts(input);
  const out: { base: FlagshipId; name: string | null; theme: StoreTheme }[] = [];
  const seen = new Set<string>();
  for (const [i, r] of list.entries()) {
    const n = normalizeOption(r, input.lang, copyFor(input, niche, i));
    if (n && !seen.has(fingerprint(n.theme))) { seen.add(fingerprint(n.theme)); out.push(n); }
    if (out.length === OPTION_COUNT) break;
  }
  if (!out.length) throw new AppError("UNAVAILABLE", "ai_bad_shape");
  for (const [i, d] of fallback.entries()) {
    if (out.length === OPTION_COUNT) break;
    const n = normalizeOption(d, input.lang, copyFor(input, niche, i));
    if (n && !seen.has(fingerprint(n.theme))) { seen.add(fingerprint(n.theme)); out.push(n); }
  }
  return out.map((o, i) => ({ id: (["a", "b", "c"] as const)[i]!, niche, ...o, preview: encodePreviewTheme(o.theme) }));
}

function copyFor(i: ComposeInput, niche: Niche, k: number): { headline: string; tagline: string } {
  const noun = NOUN[niche][i.lang];
  const cat = clip(catalogTraits(i.catalog).topCategory ?? noun, 30);
  const store = clip(i.storeName, 40);
  const h = HEADLINES[i.lang][k % 3]!;
  const t = TAGLINES[i.lang][k % 3]!;
  return { headline: h(store, cat), tagline: t(noun, cat, store) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Deterministic mock (dev, tests, the demo store): niche-aware, catalogue-aware and varied.

function mockDrafts(i: ComposeInput): RawOption[] {
  const niche = detectNiche(i.brief, i.catalog, i.vibe);
  const cfg = NICHE[niche];
  const tr = catalogTraits(i.catalog);
  const h = hash(`${i.brief}|${i.vibe ?? ""}|${i.storeName}|${i.catalog.categories.join(",")}`);
  const rot = <T,>(list: readonly T[], k: number) => list[(h + k) % list.length]!;
  const usable = <T extends string>(list: readonly T[], photo: readonly string[]) => {
    const l = tr.photoRich ? list : list.filter((v) => !photo.includes(v));
    return (l.length ? l : list) as readonly T[];
  };
  // Few photos → no photo-led heroes; no cover photo → no full-bleed cover either.
  const heroes = usable(cfg.heroes, PHOTO_HEROES).filter((v) => tr.hasCover || v !== "fullbleed");
  const heroPool: readonly HeroVariant[] = heroes.length ? heroes : ["type", "stage", "banner"];
  const grids = usable(cfg.grids, PHOTO_GRIDS);
  const cards = usable(cfg.cards, PHOTO_CARDS);
  // Vibe nudges the first option's base: a "luxury" bakery still gets one luxe-leaning option.
  const vibeBase: Partial<Record<Vibe, FlagshipId>> = { luxury: "luxe", bold: "street", playful: "play", minimal: "canvas", natural: "hearth", classic: "folio" };
  const bases: FlagshipId[] = [];
  // The niche's signature base leads; the other two rotate with the brief so two stores in one niche still differ.
  const rest = cfg.bases.slice(1);
  const rotated = rest.map((_, j) => rest[(h + j) % rest.length]!);
  for (const b of [i.vibe ? vibeBase[i.vibe] : undefined, cfg.bases[0], ...rotated, ...FLAGSHIP_IDS]) if (b && !bases.includes(b)) bases.push(b);
  const usedHero = new Set<string>();
  return bases.slice(0, 3).map((base, k) => {
    const f = FLAGSHIPS[base].theme;
    // Option a keeps its base's own hero when it fits the catalogue; b and c remix hero, grid, card, surface and type.
    let hero: HeroVariant = k === 0 && heroPool.includes(f.layout!.hero!) ? f.layout!.hero! : rot(heroPool, k * 7 + 1);
    for (let j = 0; usedHero.has(hero) && j < heroPool.length; j++) hero = rot(heroPool, k * 7 + 2 + j);
    if (usedHero.has(hero)) hero = (["type", "stage", "banner", "split", "masthead"] as const).find((x) => !usedHero.has(x))!;
    usedHero.add(hero);
    const grid: GridVariant = tr.big && k === 2 ? "dense" : k === 0 && grids.includes(f.layout!.grid!) ? f.layout!.grid! : rot(grids, k * 5 + 3);
    const card: CardVariant = grid === "dense" ? "compact" : grid === "rows" ? "row" : k === 0 && cards.includes(f.layout!.card!) ? f.layout!.card! : rot(cards, k * 3 + 2);
    const sections: HomeSection[] = [...(f.layout!.sections ?? [])];
    for (const s of cfg.extra) if (!sections.includes(s) && (k + sections.length) % 2 === 0) sections.splice(Math.min(1 + k, sections.length), 0, s);
    const finalSections = sections.filter((s) => s !== "sale" || tr.onSale).filter((s) => s !== "spotlight" || tr.photoRich).slice(0, 6);
    if (!tr.onSale && !finalSections.length) finalSections.push("best");
    const pal = rot(cfg.palettes, k * 2 + (i.vibe === "luxury" || i.vibe === "bold" ? 0 : 1));
    const c = copyFor(i, niche, k);
    return {
      base,
      layout: {
        hero, grid, card,
        surface: k === 0 ? f.layout!.surface : rot(cfg.surfaces, k + 1),
        density: tr.big ? "compact" : tr.tiny ? "airy" : f.layout!.density,
        sections: finalSections,
      },
      fontPair: k === 0 ? f.type.pair : rot(cfg.pairs, k * 4 + 1),
      palette: { accent: pal[0], bg: pal[1], surface: pal[2], text: pal[3] },
      headline: c.headline,
      tagline: c.tagline,
    };
  });
}

/** Three deterministic, niche-appropriate options (no network): same store + brief → same options. */
export function mockComposition(i: ComposeInput): DesignOption[] {
  return normalizeComposition({ options: mockDrafts(i) }, i);
}

// ---------------------------------------------------------------------------------------------------------------------
// Prompt + provider call.

export function composePrompt(i: ComposeInput): { system: string; user: string } {
  const tr = catalogTraits(i.catalog);
  const bases = FLAGSHIP_IDS.map((id) => `${id} (${FLAGSHIPS[id].group}${FLAGSHIPS[id].premium ? ", premium" : ""})`).join(", ");
  return {
    system: `You are a senior brand designer composing three COMPLETE, clearly different storefront designs for a small online shop (Kurdistan/Iraq, Instagram and WhatsApp sellers).
Return ONLY JSON: {"options":[option, option, option]} where each option is
{"base":"<flagship>","name":"2-3 word design name","layout":{"header":"…","hero":"…","grid":"…","card":"…","product":"…","footer":"…","density":"…","surface":"…","motion":"…","sections":["…"]},
"fontPair":"…","palette":{"accent":"#RRGGBB","bg":"#RRGGBB","surface":"#RRGGBB","text":"#RRGGBB"},
"buttons":{"shape":"square|rounded|pill","style":"solid|outline|soft"},"cards":{"radius":"none|sm|md|lg","style":"flat|hairline|shadow","ratio":"square|portrait|landscape"},
"headline":"…","tagline":"…"}
base (flagship to start from): ${bases}.
header: ${HEADER_VARIANTS.join("|")}. hero: ${HERO_VARIANTS.join("|")}. grid: ${GRID_VARIANTS.join("|")}. card: ${CARD_VARIANTS.join("|")}.
product (product page): ${PRODUCT_LAYOUTS.join("|")}. footer: ${FOOTER_VARIANTS.join("|")}. density: ${DENSITIES.join("|")}. surface: ${SURFACES.join("|")}. motion: ${MOTIONS.join("|")}.
sections (home order, 3-6 of): ${HOME_SECTIONS.join("|")}. fontPair: ${TYPE_PAIRS.join("|")}.
Rules: the three options must differ in base, hero and palette mood (e.g. one light, one dark or bold). Fit the niche of the real catalogue below.
Photo-led heroes/grids (fullbleed, runway, spotlight, tiles, lookbook) only when most products have photos. Include "sale" only when products are on sale. Dense grid for big catalogues.
Colours: text readable on bg (at least 4.5:1); surface close to bg; accent is the brand colour (at least 3:1 on bg).
headline: one short announcement line (max 60 characters, no emoji). tagline: the hero line under the store name (max 120 characters), specific to this shop. name: short and evocative.
Write name, headline and tagline ONLY in ${LANGUAGE_NAME[i.lang]}. Never invent prices, discounts, addresses or claims the seller didn't give.`,
    user: [
      `Store name: ${i.storeName}`,
      `Vibe: ${i.vibe ?? "-"}`,
      `The seller describes the brand: ${i.brief}`,
      `Categories: ${i.catalog.categories.slice(0, 12).join(", ") || "-"}`,
      `Products (${i.catalog.productCount} active): ${i.catalog.products.slice(0, 12).map((p) => `${p.title} (${p.price} IQD${p.onSale ? ", on sale" : ""})`).join("; ") || "-"}`,
      `Photos: ${tr.photoRich ? "most products have photos" : "few products have photos"}; store cover photo: ${tr.hasCover ? "yes" : "no"}.`,
    ].join("\n"),
  };
}

export async function composeDesigns(provider: TextProvider, input: ComposeInput): Promise<DesignOption[]> {
  if (provider.name === "mock") return mockComposition(input);
  const { system, user } = composePrompt(input);
  return normalizeComposition(parseJsonText(await provider.json({ system, user, temperature: 0.9 })), input);
}
