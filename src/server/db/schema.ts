import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Translatable text: { ku: "...", ar: "...", en: "...", kmr: "..." } — every key optional. */
export type LocalizedText = Partial<Record<"ku" | "ar" | "en" | "kmr", string>>;
/** One row of a product's details table: both sides translatable (value may be the same in every locale). */
export type ProductSpec = { label: LocalizedText; value: LocalizedText };

export const localeEnum = pgEnum("locale", ["ku", "ar", "en", "kmr"]);
/** COD-shaped lifecycle — see src/lib/order-status.ts (kept in sync by tests/schema-enums.test.ts). */
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "postponed",
  "refused",
  "returned",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "fib", "zaincash", "fastpay", "qicard"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "pending", "paid", "failed", "refunded"]);
export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed", "free_delivery"]);
export const themePresetEnum = pgEnum("theme_preset", ["bazaar", "mountain", "night"]);
export const pushAudienceEnum = pgEnum("push_audience", ["seller", "customer"]);

/** One responsive rendition of an uploaded image (WebP). */
export type ImageRendition = { width: number; height: number; key: string; url: string; bytes: number };

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------- auth
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lower-cased
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  locale: localeEnum("locale").notNull().default("ku"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha256(token) — the raw token only lives in the user's cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Fixed-window rate limit counters, shared across app instances. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------- tenants
export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    tagline: jsonb("tagline").$type<LocalizedText>().notNull().default({}),
    logoUrl: text("logo_url"),
    defaultLocale: localeEnum("default_locale").notNull().default("ku"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    instagram: text("instagram"),
    city: text("city"),
    currency: text("currency").notNull().default("IQD"),
    orderSeq: integer("order_seq").notNull().default(1000),
    /** Future: custom domain mapping (verified via DNS TXT). */
    customDomain: text("custom_domain"),
    isActive: boolean("is_active").notNull().default(true),
    // ---- storefront theme (src/lib/theme.ts)
    themePreset: themePresetEnum("theme_preset").notNull().default("bazaar"),
    /** #RRGGBB override of the preset's accent; null = preset accent. */
    accentColor: text("accent_color"),
    coverImageUrl: text("cover_image_url"),
    coverImageKey: text("cover_image_key"),
    /** Tiny inline WebP data: URL shown while the cover loads. */
    coverImagePlaceholder: text("cover_image_placeholder"),
    /** Upload-pipeline WebP renditions of the cover (srcset for the store-home LCP image); [] for older covers. */
    coverImageRenditions: jsonb("cover_image_renditions").$type<ImageRendition[]>().notNull().default([]),
    about: jsonb("about").$type<LocalizedText>().notNull().default({}),
    returnPolicy: jsonb("return_policy").$type<LocalizedText>().notNull().default({}),
    // ---- promotions
    /** Subtotal (IQD) at or above which delivery is free; null = never. */
    freeDeliveryThreshold: integer("free_delivery_threshold"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("stores_slug_uq").on(t.slug),
    uniqueIndex("stores_custom_domain_uq").on(t.customDomain),
    index("stores_owner_idx").on(t.ownerId),
    check("stores_accent_color_hex", sql`${t.accentColor} IS NULL OR ${t.accentColor} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("stores_free_delivery_pos", sql`${t.freeDeliveryThreshold} IS NULL OR ${t.freeDeliveryThreshold} > 0`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("categories_store_idx").on(t.storeId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({}),
    /** Whole Iraqi dinars. */
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    /** null = stock not tracked (unlimited). */
    stock: integer("stock"),
    /** Seller's own stock-keeping code for simple products (variants carry their own). */
    sku: text("sku"),
    /** Seller-defined attributes shown as a table on the product page (Material, Size, Weight, Origin…). */
    specs: jsonb("specs").$type<ProductSpec[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_store_idx").on(t.storeId, t.isActive),
    check("products_price_nonneg", sql`${t.price} >= 0`),
    check("products_stock_nonneg", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Default rendition (≈1024 px) — what non-responsive consumers (OG image, WhatsApp, emails) use. */
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    /** Gallery order; 0 is the cover image. */
    sort: integer("sort").notNull().default(0),
    /** Intrinsic size of the largest stored rendition; null for v1 rows uploaded before the pipeline. */
    width: integer("width"),
    height: integer("height"),
    /** Tiny inline WebP data: URL (LQIP) for blur-up placeholders. */
    placeholder: text("placeholder"),
    /** Average colour (#RRGGBB) — background while loading, cheaper than the placeholder. */
    dominantColor: text("dominant_color"),
    /** Responsive WebP renditions, ascending width (src/server/storage/pipeline.ts). */
    renditions: jsonb("renditions").$type<ImageRendition[]>().notNull().default([]),
    alt: jsonb("alt").$type<LocalizedText>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("product_images_product_idx").on(t.productId, t.sort),
    check("product_images_dims_pos", sql`(${t.width} IS NULL AND ${t.height} IS NULL) OR (${t.width} IS NOT NULL AND ${t.height} IS NOT NULL AND ${t.width} > 0 AND ${t.height} > 0)`),
  ],
);

/** A product option axis, e.g. "Size" or "Colour". */
export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_options_product_idx").on(t.productId)],
);

/** A value on an option axis, e.g. "M" or "Red" (with an optional colour swatch). */
export const productOptionValues = pgTable(
  "product_option_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => productOptions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    label: jsonb("label").$type<LocalizedText>().notNull(),
    /** #RRGGBB swatch for colour options. */
    swatch: text("swatch"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("product_option_values_option_idx").on(t.optionId),
    check("product_option_values_swatch_hex", sql`${t.swatch} IS NULL OR ${t.swatch} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

/**
 * A purchasable combination of option values. A product with no variant rows is sold as itself
 * (products.price / products.stock); once it has variants, each variant carries its own stock and optional price.
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** product_option_values ids, one per option, in option order. */
    optionValueIds: uuid("option_value_ids").array().notNull().default(sql`'{}'::uuid[]`),
    sku: text("sku"),
    /** null = the product's price. Whole IQD. */
    price: integer("price"),
    compareAtPrice: integer("compare_at_price"),
    /** null = not tracked (unlimited). */
    stock: integer("stock"),
    /** Image shown when this variant is picked. */
    imageId: uuid("image_id").references(() => productImages.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    uniqueIndex("product_variants_store_sku_uq").on(t.storeId, t.sku).where(sql`${t.sku} IS NOT NULL`),
    check("product_variants_price_nonneg", sql`${t.price} IS NULL OR ${t.price} >= 0`),
    check("product_variants_stock_nonneg", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
  ],
);

/** Reference list of Iraq's governorates (seeded by migration 0001, mirrors src/lib/governorates.ts). */
export const governorates = pgTable("governorates", {
  key: text("key").primaryKey(),
  name: jsonb("name").$type<LocalizedText>().notNull(),
  /** "kurdistan" | "federal" */
  region: text("region").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Stable zone key, e.g. "erbil" (a governorate key) or a seller-defined one like "ranya". */
    cityKey: text("city_key").notNull(),
    /** The governorate this zone delivers to; null only for legacy seller-defined zones not yet assigned. */
    governorateKey: text("governorate_key").references(() => governorates.key),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    fee: integer("fee").notNull(),
    /** Delivery estimate in days shown before checkout. */
    etaMinDays: integer("eta_min_days"),
    etaMaxDays: integer("eta_max_days"),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    uniqueIndex("delivery_zones_store_city_uq").on(t.storeId, t.cityKey),
    check("delivery_zones_fee_nonneg", sql`${t.fee} >= 0`),
    check(
      "delivery_zones_eta_valid",
      sql`(${t.etaMinDays} IS NULL OR ${t.etaMinDays} >= 0) AND (${t.etaMaxDays} IS NULL OR ${t.etaMinDays} IS NULL OR ${t.etaMaxDays} >= ${t.etaMinDays})`,
    ),
  ],
);

/** Seller-defined areas inside a zone (neighbourhood / town), optionally with their own fee. */
export const deliveryAreas = pgTable(
  "delivery_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => deliveryZones.id, { onDelete: "cascade" }),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    /** null = the zone's fee. */
    fee: integer("fee"),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("delivery_areas_zone_idx").on(t.zoneId),
    index("delivery_areas_store_idx").on(t.storeId),
    check("delivery_areas_fee_nonneg", sql`${t.fee} IS NULL OR ${t.fee} >= 0`),
  ],
);

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Stored upper-case; shoppers type it case-insensitively. */
    code: text("code").notNull(),
    type: discountTypeEnum("type").notNull(),
    /** percentage: 1–100 · fixed: IQD · free_delivery: 0. */
    value: integer("value").notNull().default(0),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("discount_codes_store_code_uq").on(t.storeId, t.code),
    check("discount_codes_code_upper", sql`${t.code} = upper(${t.code}) AND ${t.code} ~ '^[A-Z0-9_-]{3,32}$'`),
    check("discount_codes_value_nonneg", sql`${t.value} >= 0 AND ${t.minSubtotal} >= 0 AND ${t.usedCount} >= 0`),
    check("discount_codes_pct_range", sql`${t.type} <> 'percentage' OR (${t.value} BETWEEN 1 AND 100)`),
    check("discount_codes_max_uses_pos", sql`${t.maxUses} IS NULL OR ${t.maxUses} > 0`),
    check("discount_codes_window", sql`${t.startsAt} IS NULL OR ${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
  ],
);

export const storePaymentMethods = pgTable(
  "store_payment_methods",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.method] })],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    cityKey: text("city_key"),
    address: text("address"),
    areaName: text("area_name"),
    /** Iraqi addresses are landmark-based: "behind the Bazaar Mosque". */
    landmark: text("landmark"),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpent: integer("total_spent").notNull().default(0),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("customers_store_phone_uq").on(t.storeId, t.phone)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** Unguessable id used in public confirmation URLs. */
    publicId: text("public_id").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    /** Delivery zone key (see delivery_zones.city_key) and its display name at order time. */
    cityKey: text("city_key").notNull(),
    cityName: text("city_name").notNull(),
    governorateKey: text("governorate_key").references(() => governorates.key),
    areaId: uuid("area_id").references(() => deliveryAreas.id, { onDelete: "set null" }),
    areaName: text("area_name"),
    address: text("address").notNull(),
    landmark: text("landmark"),
    notes: text("notes"),
    subtotal: integer("subtotal").notNull(),
    discountCodeId: uuid("discount_code_id").references(() => discountCodes.id, { onDelete: "set null" }),
    /** Code as typed at checkout (kept even if the code is later deleted). */
    discountCode: text("discount_code"),
    discountAmount: integer("discount_amount").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    courierName: text("courier_name"),
    trackingNumber: text("tracking_number"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    locale: localeEnum("locale").notNull().default("ku"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_store_number_uq").on(t.storeId, t.number),
    index("orders_store_created_idx").on(t.storeId, t.createdAt),
    index("orders_store_status_idx").on(t.storeId, t.status),
    check("orders_discount_nonneg", sql`${t.discountAmount} >= 0 AND ${t.discountAmount} <= ${t.subtotal}`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** e.g. "M / Red" at order time. */
    variantTitle: text("variant_title"),
    sku: text("sku"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_qty_pos", sql`${t.quantity} > 0`)],
);

/**
 * Order status history: one row per transition (the first row has fromStatus = null).
 * Snapshots courier/tracking at the time of the change so the shopper's tracking timeline is reproducible.
 */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    courierName: text("courier_name"),
    trackingNumber: text("tracking_number"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);
/** Alias: the status-history table (physically `order_events`, kept for v1 compatibility). */
export const orderStatusHistory = orderEvents;

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    provider: paymentMethodEnum("provider").notNull(),
    providerRef: text("provider_ref").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amount: integer("amount").notNull(),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("payment_tx_provider_ref_uq").on(t.provider, t.providerRef), index("payment_tx_order_idx").on(t.orderId)],
);

/** Processed webhook event ids, for idempotency. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // `${provider}:${eventId}`
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------- marketing
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  instagram: text("instagram"),
  sells: text("sells").notNull(),
  city: text("city").notNull(),
  locale: localeEnum("locale").notNull().default("ku"),
  createdAt: createdAt(),
});


// ---------------------------------------------------------------- web push
/** Web Push subscriptions: sellers (new-order alerts) and shoppers (order tracking updates). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    audience: pushAudienceEnum("audience").notNull(),
    /** Seller account (audience = seller). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    /** Shopper subscriptions follow one order. */
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint),
    index("push_subscriptions_store_idx").on(t.storeId),
    index("push_subscriptions_user_idx").on(t.userId),
    check(
      "push_subscriptions_owner",
      sql`(${t.audience} = 'seller' AND ${t.userId} IS NOT NULL AND ${t.storeId} IS NOT NULL) OR (${t.audience} = 'customer' AND ${t.orderId} IS NOT NULL)`,
    ),
  ],
);
