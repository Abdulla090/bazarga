import { z } from "zod";
import type { RenditionLike } from "./responsive-image";

/** Public showcase (docs/DEMAND.md D4). Only stores whose owner opted in, that are active and have products, appear. */
export const SHOWCASE_LIMIT = 24;

export const showcaseOptInSchema = z.object({ optIn: z.enum(["on", "off"]).transform((v) => v === "on") });

export type ShowcaseStore = {
  slug: string;
  name: string;
  tagline: Record<string, string>;
  city: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  coverRenditions: RenditionLike[];
  coverPlaceholder: string | null;
  productCount: number;
  foundingNumber: number | null;
  /** Seeded demo seller: shown with a "Demo store" chip so it never reads as real traction. */
  isDemo: boolean;
};
