import { z } from "zod";
import { CARD_VARIANTS, DENSITIES, DESIGN_IDS, FOOTER_VARIANTS, GRID_VARIANTS, HEADER_VARIANTS, HERO_VARIANTS, HOME_SECTIONS, MOTIONS, PRODUCT_LAYOUTS, SURFACES, TYPE_PAIRS } from "./designs";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const THEME_VERSION = 1 as const;

export const themeSchema = z.object({
  v: z.literal(THEME_VERSION),
  preset: z.string().max(32),
  /** Layout family (header, hero, section order, grid, card, footer); absent in stores saved before designs → classic. */
  design: z.enum(DESIGN_IDS).default("classic"),
  colors: z.object({ accent: hex, bg: hex, surface: hex, text: hex }),
  type: z.object({
    pair: z.enum(TYPE_PAIRS),
    scale: z.enum(["s", "m", "l"]),
  }),
  buttons: z.object({
    shape: z.enum(["square", "rounded", "pill"]),
    style: z.enum(["solid", "outline", "soft"]),
    size: z.enum(["s", "m", "l"]),
  }),
  cards: z.object({
    radius: z.enum(["none", "sm", "md", "lg"]),
    style: z.enum(["flat", "hairline", "shadow"]),
    ratio: z.enum(["square", "portrait", "landscape"]),
  }),
  background: z.object({ kind: z.enum(["solid", "gradient", "pattern"]) }),
  header: z.object({ layout: z.enum(HEADER_VARIANTS), announce: z.string().max(80).optional() }),
  /**
   * Design system v2 (docs/DESIGN-SYSTEM.md): per-section variants laid over the design (mix and match, flagship themes,
   * AI compositions). Every key optional; absent → the design's own default. Themes saved before v2 have none.
   */
  layout: z
    .object({
      header: z.enum(HEADER_VARIANTS),
      hero: z.enum(HERO_VARIANTS),
      grid: z.enum(GRID_VARIANTS),
      card: z.enum(CARD_VARIANTS),
      footer: z.enum(FOOTER_VARIANTS),
      product: z.enum(PRODUCT_LAYOUTS),
      density: z.enum(DENSITIES),
      surface: z.enum(SURFACES),
      motion: z.enum(MOTIONS),
      sections: z.array(z.enum(HOME_SECTIONS)).max(HOME_SECTIONS.length),
    })
    .partial()
    .optional(),
  /** AI Website Designer (SF10): hero tagline written in the store language; publishing copies it into the store tagline. */
  copy: z.object({ lang: z.enum(["ku", "kmr", "ar", "en"]), tagline: z.string().trim().max(140) }).optional(),
});

export type StoreTheme = z.infer<typeof themeSchema>;
