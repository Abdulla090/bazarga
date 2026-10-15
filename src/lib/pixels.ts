import { z } from "zod";

/**
 * Seller's own TikTok / Meta pixels (S5). The seller pastes the ID from their ads manager; the storefront loads the
 * vendor script (after first interaction, never when the shopper sends Do Not Track / Global Privacy Control) and
 * fires four events. Nothing personal is sent: no name, phone or address, only product ids, names and the order value.
 */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** TikTok pixel codes are 8-32 letters/digits (e.g. CABCDEF1234567890ABC). Stored upper-case. */
export const tiktokPixelIdSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{8,32}$/, { message: "invalid_pixel" })
    .transform((v) => v.toUpperCase())
    .nullable(),
);

/** Meta (Facebook) pixel IDs are 8-20 digits. */
export const metaPixelIdSchema = z.preprocess(blankToNull, z.string().trim().regex(/^\d{8,20}$/, { message: "invalid_pixel" }).nullable());

export const storePixelsSchema = z.object({ tiktokPixelId: tiktokPixelIdSchema, metaPixelId: metaPixelIdSchema });
export type StorePixelsInput = z.infer<typeof storePixelsSchema>;

export { PIXEL_EVENTS, safePixelId, trackingAllowed, vendorEvent } from "./pixels-client";
export type { PixelData, PixelEvent } from "./pixels-client";
