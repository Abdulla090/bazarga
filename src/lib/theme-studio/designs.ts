/**
 * Store design families. A preset is no longer just tokens: its `design` picks which layout components the storefront
 * renders (header, hero, section order, product grid, card, footer). Tokens (colours, radius, type size) still come
 * from the theme JSON; the design decides composition. Pure and shared by the server renderer, the editor and tests.
 */
export const DESIGN_IDS = ["classic", "editorial", "gallery", "boutique", "mono", "studio", "market"] as const;
export type DesignId = (typeof DESIGN_IDS)[number];

/** Designs that have their own layout components today; the rest render as "classic" until their slice ships. */
export const BUILT_DESIGNS = ["classic", "editorial", "market", "gallery"] as const satisfies readonly DesignId[];

export type HeroVariant = "split" | "masthead" | "banner" | "fullbleed";
export type GridVariant = "auto" | "magazine" | "dense" | "tiles";
export type CardVariant = "classic" | "editorial" | "compact" | "tile";
export type HomeSection = "offers" | "collections" | "best" | "spotlight" | "sale" | "rail";
export type FooterVariant = "classic" | "editorial" | "dense" | "minimal";

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
};

export const DESIGNS: Record<DesignId, DesignSpec> = {
  classic: {
    id: "classic", hero: "split", grid: "auto", card: "classic", footer: "classic", pageSize: 24, cardTitle: "sans",
    sections: ["offers", "collections", "best", "spotlight", "sale"],
  },
  editorial: {
    id: "editorial", hero: "masthead", grid: "magazine", card: "editorial", footer: "editorial", pageSize: 18, cardTitle: "display",
    sections: ["offers", "spotlight", "collections", "best"],
  },
  market: {
    id: "market", hero: "banner", grid: "dense", card: "compact", footer: "dense", pageSize: 40, cardTitle: "sans",
    sections: ["offers", "sale", "best"],
  },
  gallery: {
    id: "gallery", hero: "fullbleed", grid: "tiles", card: "tile", footer: "minimal", pageSize: 24, cardTitle: "sans",
    sections: ["offers", "best", "collections", "sale"],
  },
  // Not built yet: same composition as classic (see BUILT_DESIGNS).
  boutique: { id: "boutique", hero: "split", grid: "auto", card: "classic", footer: "classic", pageSize: 24, cardTitle: "sans", sections: ["offers", "collections", "best", "spotlight", "sale"] },
  mono: { id: "mono", hero: "split", grid: "auto", card: "classic", footer: "classic", pageSize: 24, cardTitle: "sans", sections: ["offers", "collections", "best", "spotlight", "sale"] },
  studio: { id: "studio", hero: "split", grid: "auto", card: "classic", footer: "classic", pageSize: 24, cardTitle: "sans", sections: ["offers", "collections", "best", "spotlight", "sale"] },
};

export function isDesignId(v: unknown): v is DesignId {
  return typeof v === "string" && (DESIGN_IDS as readonly string[]).includes(v);
}

/** The composition to render for a design id; unknown ids and not-yet-built designs fall back to classic. */
export function designSpec(id: unknown): DesignSpec {
  return isDesignId(id) && (BUILT_DESIGNS as readonly string[]).includes(id) ? DESIGNS[id] : DESIGNS.classic;
}

/** Numbering of the visible home sections, in the design's own order ("01", "02"…); sections that are absent get "". */
export function numberSections(order: readonly HomeSection[], present: Partial<Record<HomeSection, boolean>>): Record<HomeSection, string> {
  const out = { offers: "", collections: "", best: "", spotlight: "", sale: "", rail: "" } as Record<HomeSection, string>;
  let n = 0;
  for (const s of order) if (present[s]) out[s] = String(++n).padStart(2, "0");
  return out;
}
