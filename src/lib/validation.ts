import { z } from "zod";
import { LOCALES } from "./i18n";
import { normalizePhone } from "./phone";
import { isValidSlug } from "./slug";
import { ORDER_STATUSES, PAYMENT_METHODS } from "./order-status";

/** Shared Zod schemas. Every server action / route handler parses input through one of these. */

const trimmed = (max: number) => z.string().trim().max(max);
export const localeSchema = z.enum(LOCALES);

export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(24)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "invalid_phone" });
      return z.NEVER;
    }
    return n;
  });

export const optionalPhone = z
  .string()
  .trim()
  .max(24)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "invalid_phone" });
      return z.NEVER;
    }
    return n;
  });

export const localizedTextSchema = z
  .object({
    ku: trimmed(2000).optional(),
    ar: trimmed(2000).optional(),
    en: trimmed(2000).optional(),
    kmr: trimmed(2000).optional(),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.length > 0)) as Partial<Record<(typeof LOCALES)[number], string>>);

export const requiredLocalizedName = localizedTextSchema.refine((o) => Object.keys(o).length > 0, {
  message: "name_required",
});

const iqd = z.coerce.number().int().min(0).max(1_000_000_000);
const uuid = z.uuid();

// ---------------------------------------------------------------- auth
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(8, "password_short").max(200);

export const signUpSchema = z.object({
  name: trimmed(80).min(1),
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.default("ku"),
});
export const logInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

// ---------------------------------------------------------------- store
export const storeSchema = z.object({
  name: trimmed(80).min(2),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidSlug, { message: "invalid_slug" }),
  defaultLocale: localeSchema.default("ku"),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") : null))
    .refine((v) => v === null || /^[A-Za-z0-9._]{1,30}$/.test(v), { message: "invalid_instagram" }),
  city: trimmed(60).optional().transform((v) => v || null),
  tagline: localizedTextSchema.optional(),
});
export type StoreInput = z.infer<typeof storeSchema>;

// ---------------------------------------------------------------- catalog
/** Only same-origin paths (uploads, seed images) or https URLs (S3/R2 public bucket). */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((u) => (u.startsWith("/") && !u.startsWith("//")) || u.startsWith("https://"), { message: "invalid_image_url" });

export const categorySchema = z.object({ name: requiredLocalizedName, sort: z.coerce.number().int().default(0) });

export const productSchema = z
  .object({
    name: requiredLocalizedName,
    description: localizedTextSchema.default({}),
    price: iqd,
    compareAtPrice: iqd.nullable().optional(),
    stock: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    categoryId: uuid.nullable().optional(),
    isActive: z.coerce.boolean().default(true),
    imageUrls: z.array(imageUrlSchema).max(8).default([]),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: "compare_at_must_exceed_price",
    path: ["compareAtPrice"],
  });
export type ProductInput = z.infer<typeof productSchema>;

export const deliveryZoneSchema = z.object({
  cityKey: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  name: requiredLocalizedName,
  fee: iqd,
  isActive: z.coerce.boolean().default(true),
});

export const paymentToggleSchema = z.object({ method: z.enum(PAYMENT_METHODS), enabled: z.coerce.boolean() });

// ---------------------------------------------------------------- checkout
export const cartItemSchema = z.object({ productId: uuid, quantity: z.coerce.number().int().min(1).max(99) });
export const cartSchema = z.array(cartItemSchema).min(1).max(50);

export const checkoutSchema = z.object({
  items: cartSchema,
  customerName: trimmed(80).min(2),
  phone: phoneSchema,
  cityKey: z.string().trim().min(2).max(40),
  address: trimmed(300).min(3),
  notes: trimmed(500).optional().transform((v) => v || null),
  paymentMethod: z.enum(PAYMENT_METHODS),
  locale: localeSchema.default("ku"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderStatusSchema = z.object({ orderId: uuid, status: z.enum(ORDER_STATUSES), note: trimmed(300).optional() });

// ---------------------------------------------------------------- marketing
export const waitlistSchema = z.object({
  name: trimmed(80).min(1),
  whatsapp: phoneSchema,
  instagram: trimmed(60).optional().transform((v) => v || null),
  sells: trimmed(60).min(1),
  city: trimmed(60).min(1),
  locale: localeSchema.default("ku"),
});
