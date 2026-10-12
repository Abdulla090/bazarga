import { z } from "zod";
import { DESIGN_IDS } from "./designs";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const THEME_VERSION = 1 as const;

export const themeSchema = z.object({
  v: z.literal(THEME_VERSION),
  preset: z.string().max(32),
  /** Layout family (header, hero, section order, grid, card, footer); absent in stores saved before designs → classic. */
  design: z.enum(DESIGN_IDS).default("classic"),
  colors: z.object({ accent: hex, bg: hex, surface: hex, text: hex }),
  type: z.object({
    pair: z.enum(["sans-clean", "serif-editorial", "rounded-soft", "mono-bold"]),
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
  header: z.object({ layout: z.enum(["centered", "split", "minimal"]), announce: z.string().max(80).optional() }),
});

export type StoreTheme = z.infer<typeof themeSchema>;
