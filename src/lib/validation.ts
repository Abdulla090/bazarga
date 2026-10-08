import { z } from "zod";
import { PRODUCT_BADGES } from "./merch";
import { LOCALES } from "./i18n";
import { normalizeIraqiMobile, normalizePhone } from "./phone";
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

/** Short translatable cell (spec label/value): trimmed, ≤120 chars per locale, empty locales dropped. */
const specText = z
  .object({ ku: trimmed(120).optional(), ar: trimmed(120).optional(), en: trimmed(120).optional(), kmr: trimmed(120).optional() })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.length > 0)) as Partial<Record<(typeof LOCALES)[number], string>>);

/** Max rows in a product's details table. */
export const MAX_SPECS = 20;

/**
 * Seller-defined details table: rows left completely blank are dropped (an "add row" the seller never filled),
 * a row needs a label and a value in at least one language each.
 */
export const productSpecsSchema = z
  .array(z.object({ label: specText, value: specText }))
  .transform((rows) => rows.filter((r) => Object.keys(r.label).length > 0 || Object.keys(r.value).length > 0))
  .pipe(
    z
      .array(
        z.object({
          label: z.record(z.string(), z.string()).refine((o) => Object.keys(o).length > 0, { message: "spec_label_required" }),
          value: z.record(z.string(), z.string()).refine((o) => Object.keys(o).length > 0, { message: "spec_value_required" }),
        }),
      )
      .max(MAX_SPECS, { message: "too_many_specs" }),
  )
  .transform((rows) => rows as { label: Partial<Record<(typeof LOCALES)[number], string>>; value: Partial<Record<(typeof LOCALES)[number], string>> }[]);

/**
 * Specs rows come as `specs.<row>.label.<locale>` / `specs.<row>.value.<locale>`; row indexes may have gaps
 * (rows removed in the form), so they are collected and ordered by index.
 */
export function specsFromForm(fd: FormData): unknown[] {
  const rows = new Map<number, { label: Record<string, string>; value: Record<string, string> }>();
  for (const [k, v] of fd.entries()) {
    const m = /^specs\.(\d{1,3})\.(label|value)\.(ku|ar|en|kmr)$/.exec(k);
    if (!m || typeof v !== "string") continue;
    const i = Number(m[1]);
    const row = rows.get(i) ?? { label: {}, value: {} };
    row[m[2] as "label" | "value"][m[3]!] = v;
    rows.set(i, row);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);
}

export const skuSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^[A-Za-z0-9._\/-]*$/, { message: "invalid_sku" })
  .transform((v) => (v.length ? v : null));

export const productSchema = z
  .object({
    name: requiredLocalizedName,
    description: localizedTextSchema.default({}),
    price: iqd,
    compareAtPrice: iqd.nullable().optional(),
    stock: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    sku: skuSchema.nullable().optional(),
    specs: productSpecsSchema.default([]),
    categoryId: uuid.nullable().optional(),
    /** Manual storefront badge; "" / absent = none. */
    badge: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(PRODUCT_BADGES).nullable()).optional(),
    isActive: z.coerce.boolean().default(true),
    /** Legacy/simple form: bare URLs (no responsive metadata). Ignored when `images` is given. */
    imageUrls: z.array(imageUrlSchema).max(8).default([]),
    images: z.array(productImageSchema).max(8).optional(),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: "compare_at_must_exceed_price",
    path: ["compareAtPrice"],
  });
/** Parsed product input; `specs` optional for direct (seed/test) callers, which default to an empty table. */
export type ProductInput = Omit<z.infer<typeof productSchema>, "specs"> & { specs?: z.infer<typeof productSchema>["specs"] };

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

/** Checkout phone: Iraqi mobiles only (Korek/Asiacell/Zain), stored as "+9647XXXXXXXXX". */
export const iraqiMobileSchema = z
  .string()
  .trim()
  .min(6)
  .max(24)
  .transform((v, ctx) => {
    const r = normalizeIraqiMobile(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.reason });
      return z.NEVER;
    }
    return r.e164;
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const checkoutSchema = z.object({
  items: cartSchema,
  customerName: trimmed(80).min(2),
  phone: iraqiMobileSchema,
  cityKey: z.string().trim().min(2).max(40),
  /** A seller-defined area of the chosen city's zone… */
  areaId: z.preprocess((v) => (v === "" ? null : v), uuid.nullish()).transform((v) => v ?? null),
  /** …or the shopper's own when it isn't listed ("Other area"). */
  areaOther: optionalText(80),
  landmark: optionalText(200),
  discountCode: optionalText(40),
  /** Street / building — optional when a landmark is given (Iraqi addresses are landmark-based). */
  address: trimmed(300).default(""),
  notes: trimmed(500).optional().transform((v) => v || null),
  paymentMethod: z.enum(PAYMENT_METHODS),
  locale: localeSchema.default("ku"),
  /** Honeypot (the checkout's visually hidden "website" input): any value refuses the order (src/lib/order-risk.ts). */
  hp: z.string().max(200).nullish().catch("x"),
  /** ms the checkout form was open before submit; garbage is ignored rather than failing the order. */
  elapsedMs: z.number().int().nonnegative().max(2_147_483_647).optional().catch(undefined),
}).superRefine((v, ctx) => {
  if (!v.landmark && v.address.length < 3) ctx.addIssue({ code: "custom", path: ["landmark"], message: "address_required" });
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderStatusSchema = z.object({
  orderId: uuid,
  status: z.enum(ORDER_STATUSES),
  note: trimmed(300).optional().transform((v) => v || undefined),
  /** Only used when marking "out for delivery" (shipped); blank → cleared. */
  courierName: trimmed(80).optional(),
  trackingNumber: trimmed(80).optional(),
});

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
  /** Pipeline renditions of the cover; malformed metadata is dropped (the cover still shows from its URL). */
  coverImageRenditions: productImageSchema.shape.renditions.catch([]),
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
export type StoreStorefrontInput = Omit<z.infer<typeof storeStorefrontSchema>, "coverImageRenditions"> & {
  coverImageRenditions?: z.infer<typeof storeStorefrontSchema>["coverImageRenditions"];
};

// ---------------------------------------------------------------- dashboard: discount codes
/** Dashboard-created code types (free-delivery codes stay possible in the schema but aren't offered in the UI yet). */
export const DASH_DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export const MAX_DISCOUNT_PERCENT = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Iraq has no DST: a seller's calendar day is always UTC+3. */
const IRAQ_OFFSET = "+03:00";

/** "2026-10-08" → that day's 00:00 in Iraq. */
export function iraqDayStart(day: string): Date {
  return new Date(`${day}T00:00:00${IRAQ_OFFSET}`);
}
/** "2026-10-08" → the *end* of that day (exclusive: next day's 00:00 in Iraq), so an end date includes the whole day. */
export function iraqDayEndExclusive(day: string): Date {
  return new Date(iraqDayStart(day).getTime() + 86_400_000);
}
/** Inverse for form defaults: a stored instant → "YYYY-MM-DD" in Iraq. `exclusiveEnd` steps back into the last included day. */
export function toIraqDay(d: Date | null | undefined, exclusiveEnd = false): string {
  if (!d) return "";
  const t = d.getTime() - (exclusiveEnd ? 1 : 0) + 3 * 3_600_000;
  return new Date(t).toISOString().slice(0, 10);
}

const optionalDay = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(DATE_RE, { message: "invalid_date", abort: true })
    // Rejects impossible days like 2026-02-31 (Date would roll them over).
    .refine((s) => {
      const d = iraqDayStart(s);
      return !Number.isNaN(d.getTime()) && toIraqDay(d) === s;
    }, { message: "invalid_date" })
    .nullable(),
);
const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === undefined ? null : parseIqdInput(v)),
  z.number({ message: "VALIDATION" }).int().positive().max(1_000_000_000).nullable(),
);

export const discountCodeSchema = z
  .object({
    code: z
      .string()
      .transform((v) => v.trim().toUpperCase().replace(/\s+/g, ""))
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/, { message: "invalid_discount_code" })),
    type: z.enum(DASH_DISCOUNT_TYPES),
    value: z.preprocess(parseIqdInput, z.number({ message: "VALIDATION" }).int().positive().max(1_000_000_000)),
    minSubtotal: z.preprocess((v) => parseIqdInput(v) ?? 0, z.number({ message: "VALIDATION" }).int().min(0).max(1_000_000_000)),
    maxUses: optionalPositiveInt,
    startsOn: optionalDay,
    endsOn: optionalDay,
    isActive: z.coerce.boolean().default(true),
    /** Advertise on the storefront (offer banner). */
    showOnStorefront: z.coerce.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percentage" && (v.value < 1 || v.value > MAX_DISCOUNT_PERCENT))
      ctx.addIssue({ code: "custom", path: ["value"], message: "invalid_percent" });
    if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "invalid_date_range" });
  })
  .transform(({ startsOn, endsOn, ...rest }) => ({
    ...rest,
    startsAt: startsOn ? iraqDayStart(startsOn) : null,
    endsAt: endsOn ? iraqDayEndExclusive(endsOn) : null,
  }));
export type DiscountCodeInput = z.infer<typeof discountCodeSchema>;

// ---------------------------------------------------------------- dashboard: delivery areas
export const deliveryAreaSchema = z.object({
  name: requiredLocalizedName,
  /** Empty = use the city's fee. */
  fee: z.preprocess(
    (v) => (v === "" || v === undefined ? null : parseIqdInput(v)),
    z.number({ message: "VALIDATION" }).int().min(0).max(1_000_000).nullable(),
  ),
});
export type DeliveryAreaInput = z.infer<typeof deliveryAreaSchema>;
