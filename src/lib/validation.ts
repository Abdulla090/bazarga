import { z } from "zod";
import { LOCALES } from "./i18n";
import { normalizePhone } from "./phone";
import { isValidSlug } from "./slug";
import { ORDER_STATUSES, PAYMENT_METHODS } from "./order-status";
import { HEX_COLOR_RE, THEME_PRESETS } from "./theme";

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

/** Storefront look (stores.theme_preset / accent_color / about / return_policy). */
export const storeThemeSchema = z.object({
  themePreset: z.enum(THEME_PRESETS).default("bazaar"),
  accentColor: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || HEX_COLOR_RE.test(v), { message: "invalid_color" }),
  about: localizedTextSchema.default({}),
  returnPolicy: localizedTextSchema.default({}),
});
export type StoreThemeInput = z.infer<typeof storeThemeSchema>;

// ---------------------------------------------------------------- catalog
/** Only same-origin paths (uploads, seed images) or https URLs (S3/R2 public bucket). */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((u) => (u.startsWith("/") && !u.startsWith("//")) || u.startsWith("https://"), { message: "invalid_image_url" });

/** Image metadata produced by the upload pipeline (/api/uploads) and round-tripped through the product form. */
export const productImageSchema = z.object({
  url: imageUrlSchema,
  width: z.number().int().positive().max(20_000).nullable().optional(),
  height: z.number().int().positive().max(20_000).nullable().optional(),
  placeholder: z
    .string()
    .max(4000)
    .regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
    .nullable()
    .optional(),
  dominantColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  renditions: z
    .array(
      z.object({
        width: z.number().int().positive().max(20_000),
        height: z.number().int().positive().max(20_000),
        url: imageUrlSchema,
        key: z.string().max(300),
        bytes: z.number().int().nonnegative(),
      }),
    )
    .max(8)
    .default([]),
});
export type ProductImageInput = z.infer<typeof productImageSchema>;

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
    /** Legacy/simple form: bare URLs (no responsive metadata). Ignored when `images` is given. */
    imageUrls: z.array(imageUrlSchema).max(8).default([]),
    images: z.array(productImageSchema).max(8).optional(),
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
export const cartItemSchema = z.object({
  productId: uuid,
  /** Required (server-checked) when the product has variants; absent/null for simple products. */
  variantId: uuid.nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(99),
});
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

// ---------------------------------------------------------------- storefront look: cover + free delivery
/** Max free-delivery threshold: 100 million IQD — anything above is a typo. */
export const MAX_FREE_DELIVERY_THRESHOLD = 100_000_000;

/** Parses "50,000", "٥٠٬٠٠٠", "50000 IQD" → 50000; empty → null; anything else → NaN (rejected by the schema). */
export function parseIqdInput(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const ascii = String(v)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/(iqd|د\.ع|دینار|دينار)/gi, "")
    .replace(/[\s,،٬]/g, "");
  if (!ascii) return null;
  return /^\d+$/.test(ascii) ? Number(ascii) : Number.NaN;
}

const emptyToNullish = (v: unknown) => (v === "" || v === undefined ? null : v);

export const storeStorefrontSchema = z.object({
  coverImageUrl: z.preprocess(emptyToNullish, imageUrlSchema.nullable()),
  /** Tiny inline WebP from the upload pipeline; a malformed one is dropped rather than failing the save. */
  coverImagePlaceholder: z.preprocess(emptyToNullish, productImageSchema.shape.placeholder).catch(null).transform((v) => v ?? null),
  freeDeliveryThreshold: z.preprocess(
    parseIqdInput,
    z
      .number({ message: "invalid_threshold" })
      .int({ message: "invalid_threshold" })
      .positive({ message: "invalid_threshold" })
      .max(MAX_FREE_DELIVERY_THRESHOLD, { message: "invalid_threshold" })
      .nullable(),
  ),
});
export type StoreStorefrontInput = z.infer<typeof storeStorefrontSchema>;
