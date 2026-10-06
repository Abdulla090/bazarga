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

export const localeEnum = pgEnum("locale", ["ku", "ar", "en", "kmr"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "fib", "zaincash", "fastpay", "qicard"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "pending", "paid", "failed", "refunded"]);

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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("stores_slug_uq").on(t.slug),
    uniqueIndex("stores_custom_domain_uq").on(t.customDomain),
    index("stores_owner_idx").on(t.ownerId),
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
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Stable city key, e.g. "erbil". */
    cityKey: text("city_key").notNull(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    fee: integer("fee").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    uniqueIndex("delivery_zones_store_city_uq").on(t.storeId, t.cityKey),
    check("delivery_zones_fee_nonneg", sql`${t.fee} >= 0`),
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
    cityKey: text("city_key").notNull(),
    cityName: text("city_name").notNull(),
    address: text("address").notNull(),
    notes: text("notes"),
    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    status: orderStatusEnum("status").notNull().default("new"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    locale: localeEnum("locale").notNull().default("ku"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_store_number_uq").on(t.storeId, t.number),
    index("orders_store_created_idx").on(t.storeId, t.createdAt),
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
    name: text("name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_qty_pos", sql`${t.quantity} > 0`)],
);

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
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

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

