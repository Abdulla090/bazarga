import type { StoreTheme } from "./schema";

/**
 * Flagship themes (design system v2, docs/DESIGN-SYSTEM.md). Each one is a complete design language, not a palette:
 * its own type pair, density, surface, motion, header, hero, grid, card anatomy, product page, footer and section set.
 * Strip the colours and they still read as different stores. Sellers can lay their own colours, fonts and per-section
 * variants over any of them (Theme Studio "Layout"), and the AI Website Designer composes from the same parts.
 *
 * Ids never change once shipped (stored themes keep `preset: <id>`). Legacy palette presets live in presets.ts.
 */
export const THEME_GROUPS = ["minimal", "editorial", "bold", "soft", "catalogue"] as const;
export type ThemeGroup = (typeof THEME_GROUPS)[number];

export const FLAGSHIP_IDS = ["luxe", "street", "blush", "folio", "circuit", "bazaar", "canvas", "glow", "hearth", "play"] as const;
export type FlagshipId = (typeof FLAGSHIP_IDS)[number];

export type Flagship = { id: FlagshipId; group: ThemeGroup; premium: boolean; theme: StoreTheme };

type T = Omit<StoreTheme, "v" | "preset">;
const f = (id: FlagshipId, group: ThemeGroup, premium: boolean, t: T): Flagship => ({ id, group, premium, theme: { v: 1, preset: id, ...t } });

export const FLAGSHIPS: Record<FlagshipId, Flagship> = {
  // Minimal Luxe (Max): ivory paper, Playfair display over hairlines, a framed runway cover, a lookbook grid where every
  // fifth piece runs double, framed cards, a single centred product column, a colophon footer. Slow fades.
  luxe: f("luxe", "minimal", true, {
    design: "atelier",
    colors: { accent: "#1C1915", bg: "#F6F2EA", surface: "#FFFDF8", text: "#1C1915" },
    type: { pair: "luxe-serif", scale: "l" },
    buttons: { shape: "square", style: "outline", size: "l" },
    cards: { radius: "none", style: "hairline", ratio: "portrait" },
    background: { kind: "solid" },
    header: { layout: "centered" },
    layout: { header: "centered", hero: "runway", grid: "lookbook", card: "frame", footer: "colophon", product: "stacked", density: "airy", surface: "paper", motion: "fade", sections: ["spotlight", "best", "story", "collections", "offers"] },
  }),
  // Bold Streetwear (Max): black blocks, condensed uppercase display (Oswald / Noto Kufi), a ticker header, a bento hero,
  // a tight bento grid with captions on the photo, wide product page, hard-edged buttons, slide-in motion.
  street: f("street", "bold", true, {
    design: "pulse",
    colors: { accent: "#FF3B2F", bg: "#0A0A0A", surface: "#171717", text: "#F5F5F5" },
    type: { pair: "condensed", scale: "l" },
    buttons: { shape: "square", style: "solid", size: "l" },
    cards: { radius: "none", style: "flat", ratio: "square" },
    background: { kind: "solid" },
    header: { layout: "ticker" },
    layout: { header: "ticker", hero: "pulse", grid: "bento", card: "glow", footer: "ticker", product: "wide", density: "compact", surface: "blocks", motion: "slide", sections: ["sale", "best", "social", "collections", "offers"] },
  }),
  // Soft Boutique: rounded everything, blush surfaces, Nunito, an arched cover, roomy soft cards, pill buttons,
  // a story block and a WhatsApp invitation.
  blush: f("blush", "soft", false, {
    design: "boutique",
    colors: { accent: "#B4566E", bg: "#FBF3F1", surface: "#FFFFFF", text: "#3A2A2E" },
    type: { pair: "rounded-soft", scale: "m" },
    buttons: { shape: "pill", style: "solid", size: "m" },
    cards: { radius: "lg", style: "flat", ratio: "portrait" },
    background: { kind: "gradient" },
    header: { layout: "centered" },
    layout: { header: "centered", hero: "arch", grid: "soft", card: "soft", footer: "soft", product: "split", density: "regular", surface: "flat", motion: "fade", sections: ["offers", "collections", "best", "story", "whatsapp"] },
  }),
  // Editorial Magazine: a masthead in Fraunces, a staggered three-column magazine grid, numbered sections, info-first
  // product page, paper grain, editorial slide.
  folio: f("folio", "editorial", false, {
    design: "editorial",
    colors: { accent: "#8C2F1B", bg: "#F3EEE4", surface: "#FBF8F2", text: "#15110D" },
    type: { pair: "serif-editorial", scale: "l" },
    buttons: { shape: "square", style: "solid", size: "m" },
    cards: { radius: "none", style: "flat", ratio: "portrait" },
    background: { kind: "solid" },
    header: { layout: "centered" },
    layout: { header: "centered", hero: "masthead", grid: "magazine", card: "editorial", footer: "editorial", product: "reverse", density: "airy", surface: "paper", motion: "slide", sections: ["spotlight", "story", "collections", "best"] },
  }),
  // Tech Gadget: dark, Space Grotesk with mono labels, a search bar header, a product spotlight hero (one real product
  // as the cover), a uniform spec-sheet grid of framed cards,
  // a wide product page that leads with the spec table, a ledger footer. No motion.
  circuit: f("circuit", "bold", false, {
    design: "classic",
    colors: { accent: "#4F8CFF", bg: "#0B0E14", surface: "#141A24", text: "#E8EDF5" },
    type: { pair: "tech-mono", scale: "m" },
    buttons: { shape: "rounded", style: "solid", size: "m" },
    cards: { radius: "sm", style: "hairline", ratio: "square" },
    background: { kind: "pattern" },
    header: { layout: "search" },
    layout: { header: "search", hero: "spotlight", grid: "auto", card: "classic", footer: "ledger", product: "wide", density: "regular", surface: "glass", motion: "none", sections: ["offers", "best", "collections", "sale"] },
  }),
  // Market Bazaar: a dense catalogue. Search bar header, deals banner, sticky category chips, six-up compact cards,
  // deals before best sellers, a WhatsApp order band.
  bazaar: f("bazaar", "catalogue", false, {
    design: "market",
    colors: { accent: "#D92D20", bg: "#F2F3F5", surface: "#FFFFFF", text: "#101828" },
    type: { pair: "sans-clean", scale: "s" },
    buttons: { shape: "rounded", style: "solid", size: "s" },
    cards: { radius: "sm", style: "hairline", ratio: "square" },
    background: { kind: "solid" },
    header: { layout: "search" },
    layout: { header: "search", hero: "banner", grid: "dense", card: "compact", footer: "dense", product: "split", density: "compact", surface: "flat", motion: "none", sections: ["offers", "sale", "collections", "best", "whatsapp"] },
  }),
  // Gallery Art: image first. Minimal header, a full-bleed cover, edge-to-edge photo tiles with names on hover, a
  // stacked product page with the photos full width, near-invisible UI.
  canvas: f("canvas", "minimal", false, {
    design: "gallery",
    colors: { accent: "#111111", bg: "#FFFFFF", surface: "#F4F4F2", text: "#111111" },
    type: { pair: "grotesk", scale: "m" },
    buttons: { shape: "square", style: "outline", size: "m" },
    cards: { radius: "none", style: "flat", ratio: "portrait" },
    background: { kind: "solid" },
    header: { layout: "minimal" },
    layout: { header: "minimal", hero: "fullbleed", grid: "tiles", card: "tile", footer: "minimal", product: "stacked", density: "airy", surface: "flat", motion: "fade", sections: ["best", "collections", "story"] },
  }),
  // Cosmetics Glow: soft gradient light, Playfair display, a spotlight stage hero, a masonry of floating cards, a product
  // spotlight band, an Instagram/TikTok strip.
  glow: f("glow", "soft", false, {
    design: "studio",
    colors: { accent: "#B83A6B", bg: "#FFF6F3", surface: "#FFFFFF", text: "#2B1B22" },
    type: { pair: "luxe-serif", scale: "m" },
    buttons: { shape: "pill", style: "solid", size: "m" },
    cards: { radius: "lg", style: "shadow", ratio: "portrait" },
    background: { kind: "gradient" },
    header: { layout: "centered" },
    layout: { header: "centered", hero: "stage", grid: "masonry", card: "float", footer: "band", product: "split", density: "regular", surface: "glow", motion: "fade", sections: ["spotlight", "best", "social", "collections", "sale"] },
  }),
  // Food & Home: warm paper, Fraunces, an asymmetric split cover, a story section near the top, cozy cards, a classic
  // multi-column footer, WhatsApp ordering.
  hearth: f("hearth", "editorial", false, {
    design: "classic",
    colors: { accent: "#9A4A2A", bg: "#F6EFE4", surface: "#FFFBF5", text: "#2A2118" },
    type: { pair: "serif-editorial", scale: "m" },
    buttons: { shape: "rounded", style: "solid", size: "m" },
    cards: { radius: "md", style: "flat", ratio: "landscape" },
    background: { kind: "pattern" },
    header: { layout: "split" },
    layout: { header: "split", hero: "split", grid: "auto", card: "classic", footer: "classic", product: "split", density: "regular", surface: "paper", motion: "fade", sections: ["offers", "story", "collections", "best", "whatsapp"] },
  }),
  // Kids / Playful: chunky Nunito, a playground hero (tinted panel, confetti shapes, tilted sticker cover), hard-bordered blocks with offset shadows, roomy soft cards,
  // a colour band footer. Bright but restrained: one accent, one background.
  play: f("play", "bold", false, {
    design: "studio",
    colors: { accent: "#4338CA", bg: "#FFFBEB", surface: "#FFFFFF", text: "#1E1B4B" },
    type: { pair: "playful", scale: "l" },
    buttons: { shape: "pill", style: "solid", size: "l" },
    cards: { radius: "lg", style: "hairline", ratio: "square" },
    background: { kind: "solid" },
    header: { layout: "split" },
    layout: { header: "split", hero: "play", grid: "soft", card: "soft", footer: "band", product: "split", density: "regular", surface: "blocks", motion: "none", sections: ["offers", "collections", "best", "sale", "whatsapp"] },
  }),
};

export const FLAGSHIP_LIST: readonly Flagship[] = FLAGSHIP_IDS.map((id) => FLAGSHIPS[id]);
export const PREMIUM_FLAGSHIPS: ReadonlySet<string> = new Set(FLAGSHIP_LIST.filter((t) => t.premium).map((t) => t.id));

export function isFlagshipId(v: unknown): v is FlagshipId {
  return typeof v === "string" && (FLAGSHIP_IDS as readonly string[]).includes(v);
}

/**
 * Legacy palette presets (before design system v2) → the flagship that now carries their look. Used by Theme Studio to
 * show which theme a store started from; stored themes themselves are never rewritten (they stay valid v1 JSON and keep
 * rendering their own design), so no store changes until its seller picks a theme.
 */
export const LEGACY_PRESET_TO_FLAGSHIP: Record<string, FlagshipId> = {
  ivory: "luxe", midnight: "circuit", gallery: "canvas", boutique: "blush", studio: "glow", stone: "hearth", mono: "street",
  editorial: "folio", market: "bazaar", fresh: "hearth", atelier: "luxe", pulse: "street",
};

/** The flagship a stored theme belongs to (its own id, or the legacy preset's successor), else null for custom/AI themes. */
export function flagshipOf(t: { preset?: string } | null | undefined): FlagshipId | null {
  const p = t?.preset;
  if (isFlagshipId(p)) return p;
  return p ? (LEGACY_PRESET_TO_FLAGSHIP[p] ?? null) : null;
}
