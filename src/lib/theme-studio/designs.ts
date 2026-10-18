/**
 * Store design families. A preset is no longer just tokens: its `design` picks which layout components the storefront
 * renders (header, hero, section order, product grid, card, footer). Tokens (colours, radius, type size) still come
 * from the theme JSON; the design decides composition. Pure and shared by the server renderer, the editor and tests.
 */
export const DESIGN_IDS = ["classic", "editorial", "gallery", "boutique", "mono", "studio", "market", "atelier", "pulse"] as const;
export type DesignId = (typeof DESIGN_IDS)[number];

/** Designs that have their own layout components today; any added later render as "classic" until their slice ships. */
export const BUILT_DESIGNS = ["classic", "editorial", "market", "gallery", "boutique", "mono", "studio", "atelier", "pulse"] as const satisfies readonly DesignId[];

/** Premium designs (Max, SF6): anyone can preview them in Theme Studio; publishing needs Max, and a store that drops below Max renders classic. */
export const PREMIUM_DESIGNS = ["atelier", "pulse"] as const satisfies readonly DesignId[];
export function isPremiumDesign(id: unknown): boolean {
  return typeof id === "string" && (PREMIUM_DESIGNS as readonly string[]).includes(id);
}

export const HERO_VARIANTS = ["split", "masthead", "banner", "fullbleed", "arch", "type", "stage", "runway", "pulse", "spotlight"] as const;
export const GRID_VARIANTS = ["auto", "magazine", "dense", "tiles", "soft", "rows", "masonry", "lookbook", "bento"] as const;
export const CARD_VARIANTS = ["classic", "editorial", "compact", "tile", "soft", "row", "float", "frame", "glow"] as const;
export const FOOTER_VARIANTS = ["classic", "editorial", "dense", "minimal", "soft", "ledger", "band", "colophon", "ticker"] as const;
export const HOME_SECTIONS = ["offers", "collections", "best", "spotlight", "sale", "story", "social", "whatsapp", "rail"] as const;
/** Header: logo start + icons (split), centered logo, minimal (no search icon), a sticky bar with a search field, an announcement ticker. */
export const HEADER_VARIANTS = ["split", "centered", "minimal", "search", "ticker"] as const;
/** Product page: gallery start + sticky buy box (split), big gallery + narrow sticky info (wide), one centred column (stacked), info first (reverse). */
export const PRODUCT_LAYOUTS = ["split", "wide", "stacked", "reverse"] as const;
export const DENSITIES = ["compact", "regular", "airy"] as const;
/** Surface treatment of the page and its cards: flat, paper (warm grain + hairlines), glass, blocks (hard borders + offset shadow), glow (soft gradients). */
export const SURFACES = ["flat", "paper", "glass", "blocks", "glow"] as const;
/** Motion personality; every one of them is off under prefers-reduced-motion. */
export const MOTIONS = ["none", "fade", "slide"] as const;
/** Category chip / search-field look. */
export const CHIP_STYLES = ["classic", "editorial", "gallery", "mono", "studio", "market"] as const;
/** Type pairs (display face + body face, each with a Kurdish/Arabic partner), see globals.css [data-type]. */
export const TYPE_PAIRS = ["sans-clean", "serif-editorial", "rounded-soft", "mono-bold", "luxe-serif", "grotesk", "condensed", "tech-mono", "playful"] as const;

export type HeroVariant = (typeof HERO_VARIANTS)[number];
export type GridVariant = (typeof GRID_VARIANTS)[number];
export type CardVariant = (typeof CARD_VARIANTS)[number];
export type HomeSection = (typeof HOME_SECTIONS)[number];
export type FooterVariant = (typeof FOOTER_VARIANTS)[number];
export type HeaderVariant = (typeof HEADER_VARIANTS)[number];
export type ProductLayout = (typeof PRODUCT_LAYOUTS)[number];
export type Density = (typeof DENSITIES)[number];
export type Surface = (typeof SURFACES)[number];
export type Motion = (typeof MOTIONS)[number];
export type ChipStyle = (typeof CHIP_STYLES)[number];
export type TypePair = (typeof TYPE_PAIRS)[number];

/** Variants that belong to the premium (Max) designs: a store below Max never renders them, whatever its theme asks. */
export const PREMIUM_VARIANTS = { hero: ["runway", "pulse"], grid: ["lookbook", "bento"], card: ["frame", "glow"], footer: ["colophon", "ticker"] } as const;

export type DesignSpec = {
  id: DesignId;
  hero: HeroVariant;
  grid: GridVariant;
  card: CardVariant;
  footer: FooterVariant;
  /** Home sections above the catalogue, in render order ("offers" = delivery/offer strip). */
  sections: readonly HomeSection[];
  /** Catalogue page size; dense catalogues show more per page. */
  pageSize: number;
  /** Product-name font role: "display" uses the design's display face. */
  cardTitle: "sans" | "display";
  header: HeaderVariant;
  product: ProductLayout;
  density: Density;
  surface: Surface;
  motion: Motion;
  chips: ChipStyle;
  type: TypePair;
};

type Base = Omit<DesignSpec, "header" | "product" | "density" | "surface" | "motion" | "chips" | "type"> & Partial<Pick<DesignSpec, "header" | "product" | "density" | "surface" | "motion" | "chips" | "type">>;
const DEF = { header: "split", product: "split", density: "regular", surface: "flat", motion: "none", chips: "classic", type: "sans-clean" } as const;
const d = (b: Base): DesignSpec => ({ ...DEF, ...b });

export const DESIGNS: Record<DesignId, DesignSpec> = {
  classic: d({
    id: "classic", hero: "split", grid: "auto", card: "classic", footer: "classic", pageSize: 24, cardTitle: "sans",
    sections: ["offers", "collections", "best", "spotlight", "sale"],
  }),
  editorial: d({
    id: "editorial", hero: "masthead", grid: "magazine", card: "editorial", footer: "editorial", pageSize: 18, cardTitle: "display", header: "centered", product: "reverse", density: "airy", surface: "paper", motion: "slide", chips: "editorial", type: "serif-editorial",
    sections: ["offers", "spotlight", "collections", "best"],
  }),
  market: d({
    id: "market", hero: "banner", grid: "dense", card: "compact", footer: "dense", pageSize: 40, cardTitle: "sans", header: "search", density: "compact", chips: "market",
    sections: ["offers", "sale", "best"],
  }),
  gallery: d({
    id: "gallery", hero: "fullbleed", grid: "tiles", card: "tile", footer: "minimal", pageSize: 24, cardTitle: "sans", header: "centered", product: "stacked", density: "airy", motion: "fade", chips: "gallery",
    sections: ["offers", "best", "collections", "sale"],
  }),
  boutique: d({
    id: "boutique", hero: "arch", grid: "soft", card: "soft", footer: "soft", pageSize: 24, cardTitle: "sans", header: "centered", chips: "studio", type: "rounded-soft", motion: "fade",
    sections: ["offers", "collections", "best", "sale"],
  }),
  // Mono: a ledger. Giant type masthead, hard black rules, products as numbered rows (thumb, name, price, add).
  mono: d({
    id: "mono", hero: "type", grid: "rows", card: "row", footer: "ledger", pageSize: 24, cardTitle: "sans", header: "minimal", product: "wide", density: "compact", chips: "mono", type: "mono-bold",
    sections: ["offers", "best", "collections", "sale"],
  }),
  // Studio: a bold creator brand. Accent-coloured stage hero with a tilted cover, masonry of floating cards (varied photo
  // ratios, round add button), pill category chips, an accent name band in the footer.
  studio: d({
    id: "studio", hero: "stage", grid: "masonry", card: "float", footer: "band", pageSize: 24, cardTitle: "sans", chips: "studio", surface: "glass", motion: "fade",
    sections: ["offers", "best", "spotlight", "collections", "sale"],
  }),
  // Atelier (premium): a couture house. Centered eyebrow + display name over a hairline-framed cinematic cover, the
  // spotlight lookbook first, a lookbook grid (every fifth piece runs double width), framed cards with display-face
  // names, a centered colophon footer.
  atelier: d({
    id: "atelier", hero: "runway", grid: "lookbook", card: "frame", footer: "colophon", pageSize: 18, cardTitle: "display", header: "centered", product: "stacked", density: "airy", surface: "paper", motion: "fade", chips: "gallery", type: "serif-editorial",
    sections: ["spotlight", "best", "collections", "offers", "sale"],
  }),
  // Pulse (premium): a night-drop streetwear/electronics brand. Bento hero (name tile, tall cover tile, accent ticker),
  // deals first, a bento grid (every seventh product is a 2×2 feature), glow cards with the caption on the photo,
  // and a ticker footer.
  pulse: d({
    id: "pulse", hero: "pulse", grid: "bento", card: "glow", footer: "ticker", pageSize: 30, cardTitle: "sans", header: "ticker", product: "wide", density: "compact", surface: "blocks", motion: "slide", chips: "mono", type: "mono-bold",
    sections: ["sale", "best", "offers", "collections"],
  }),
};

export function isDesignId(v: unknown): v is DesignId {
  return typeof v === "string" && (DESIGN_IDS as readonly string[]).includes(v);
}

/** The composition to render for a design id; unknown ids and not-yet-built designs fall back to classic. */
/** `allowPremium: false` (store below Max) turns premium designs into classic. */
export function designSpec(id: unknown, allowPremium = true): DesignSpec {
  if (!allowPremium && isPremiumDesign(id)) return DESIGNS.classic;
  return isDesignId(id) && (BUILT_DESIGNS as readonly string[]).includes(id) ? DESIGNS[id] : DESIGNS.classic;
}

/** Per-axis overrides a theme lays over its design (Theme Studio "Layout" mix-and-match, flagship themes, AI). */
export type LayoutOverrides = Partial<{
  hero: HeroVariant; grid: GridVariant; card: CardVariant; footer: FooterVariant; header: HeaderVariant; product: ProductLayout;
  density: Density; surface: Surface; motion: Motion; sections: readonly HomeSection[];
}>;

const inList = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const isPremiumVariant = (axis: keyof typeof PREMIUM_VARIANTS, v: string) => (PREMIUM_VARIANTS[axis] as readonly string[]).includes(v);

/**
 * The full composition for a theme: its design's defaults, then the theme's own overrides, then its type pair and header.
 * Below Max (`allowPremium: false`) a premium design renders classic and premium variants fall back to the base design's.
 * Pure; unknown values are ignored so a hand-edited or older theme can never break a store.
 */
export function composeDesign(
  t: { design?: unknown; layout?: LayoutOverrides | null; type?: { pair?: unknown } | null; header?: { layout?: unknown } | null } | null | undefined,
  allowPremium = true,
): DesignSpec {
  const base = designSpec(t?.design, allowPremium);
  const o = t?.layout ?? {};
  const keep = <A extends keyof typeof PREMIUM_VARIANTS>(axis: A, list: readonly string[], v: unknown): v is string => inList(list, v) && (allowPremium || !isPremiumVariant(axis, v));
  const sections = Array.isArray(o.sections) ? [...new Set(o.sections.filter((x) => inList(HOME_SECTIONS, x)))] : null;
  return {
    ...base,
    hero: keep("hero", HERO_VARIANTS, o.hero) ? (o.hero as HeroVariant) : base.hero,
    grid: keep("grid", GRID_VARIANTS, o.grid) ? (o.grid as GridVariant) : base.grid,
    card: keep("card", CARD_VARIANTS, o.card) ? (o.card as CardVariant) : base.card,
    footer: keep("footer", FOOTER_VARIANTS, o.footer) ? (o.footer as FooterVariant) : base.footer,
    // A structural header of the design (market's search bar, pulse's ticker) wins over the older 3-way header token.
    header: inList(HEADER_VARIANTS, o.header) ? o.header : base.header !== "search" && base.header !== "ticker" && inList(HEADER_VARIANTS, t?.header?.layout) ? t.header.layout : base.header,
    product: inList(PRODUCT_LAYOUTS, o.product) ? o.product : base.product,
    density: inList(DENSITIES, o.density) ? o.density : base.density,
    surface: inList(SURFACES, o.surface) ? o.surface : base.surface,
    motion: inList(MOTIONS, o.motion) ? o.motion : base.motion,
    sections: sections && sections.length ? sections : base.sections,
    type: inList(TYPE_PAIRS, t?.type?.pair) ? t.type.pair : base.type,
  };
}

/**
 * Preview cookie encoding of a composition (Theme Studio iframe): "v2.<design>.<hero>.<grid>.<card>.<footer>.<header>.
 * <product>.<density>.<surface>.<motion>.<type>.<sections joined by ->". Only ids from the lists above; cookie-safe.
 */
export function encodeComposition(s: DesignSpec): string {
  return ["v2", s.id, s.hero, s.grid, s.card, s.footer, s.header, s.product, s.density, s.surface, s.motion, s.type, s.sections.join("-")].join(".");
}

/** Parse a preview cookie: a v2 composition, or a bare design id (older editors). Null when it is neither. */
export function decodeComposition(raw: string | undefined | null): DesignSpec | null {
  if (!raw) return null;
  if (isDesignId(raw)) return designSpec(raw);
  const p = raw.split(".");
  if (p[0] !== "v2" || p.length !== 13) return null;
  const [, design, hero, grid, card, footer, header, product, density, surface, motion, type, sections] = p;
  if (!isDesignId(design)) return null;
  return composeDesign({ design, type: { pair: type }, layout: { hero, grid, card, footer, header, product, density, surface, motion, sections: (sections ?? "").split("-") } as LayoutOverrides });
}

/** Numbering of the visible home sections, in the design's own order ("01", "02"…); sections that are absent get "". */
export function numberSections(order: readonly HomeSection[], present: Partial<Record<HomeSection, boolean>>): Record<HomeSection, string> {
  const out = Object.fromEntries(HOME_SECTIONS.map((k) => [k, ""])) as Record<HomeSection, string>;
  let n = 0;
  for (const s of order) if (present[s]) out[s] = String(++n).padStart(2, "0");
  return out;
}
