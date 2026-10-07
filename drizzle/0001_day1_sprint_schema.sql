CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed', 'free_delivery');--> statement-breakpoint
CREATE TYPE "public"."push_audience" AS ENUM('seller', 'customer');--> statement-breakpoint
CREATE TYPE "public"."theme_preset" AS ENUM('bazaar', 'mountain', 'night');--> statement-breakpoint
CREATE TABLE "delivery_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"fee" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_areas_fee_nonneg" CHECK ("delivery_areas"."fee" IS NULL OR "delivery_areas"."fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_subtotal" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_upper" CHECK ("discount_codes"."code" = upper("discount_codes"."code") AND "discount_codes"."code" ~ '^[A-Z0-9_-]{3,32}$'),
	CONSTRAINT "discount_codes_value_nonneg" CHECK ("discount_codes"."value" >= 0 AND "discount_codes"."min_subtotal" >= 0 AND "discount_codes"."used_count" >= 0),
	CONSTRAINT "discount_codes_pct_range" CHECK ("discount_codes"."type" <> 'percentage' OR ("discount_codes"."value" BETWEEN 1 AND 100)),
	CONSTRAINT "discount_codes_max_uses_pos" CHECK ("discount_codes"."max_uses" IS NULL OR "discount_codes"."max_uses" > 0),
	CONSTRAINT "discount_codes_window" CHECK ("discount_codes"."starts_at" IS NULL OR "discount_codes"."ends_at" IS NULL OR "discount_codes"."ends_at" > "discount_codes"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "governorates" (
	"key" text PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"region" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"label" jsonb NOT NULL,
	"swatch" text,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_option_values_swatch_hex" CHECK ("product_option_values"."swatch" IS NULL OR "product_option_values"."swatch" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"option_value_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sku" text,
	"price" integer,
	"compare_at_price" integer,
	"stock" integer,
	"image_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_price_nonneg" CHECK ("product_variants"."price" IS NULL OR "product_variants"."price" >= 0),
	CONSTRAINT "product_variants_stock_nonneg" CHECK ("product_variants"."stock" IS NULL OR "product_variants"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" "push_audience" NOT NULL,
	"user_id" uuid,
	"store_id" uuid,
	"order_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "push_subscriptions_owner" CHECK (("push_subscriptions"."audience" = 'seller' AND "push_subscriptions"."user_id" IS NOT NULL AND "push_subscriptions"."store_id" IS NOT NULL) OR ("push_subscriptions"."audience" = 'customer' AND "push_subscriptions"."order_id" IS NOT NULL))
);
--> statement-breakpoint
-- order_status v1 → v2 (COD lifecycle). Done via text so legacy values can be mapped inside the migration
-- transaction (ALTER TYPE ... ADD VALUE cannot be used in the same transaction that adds it).
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "orders" SET "status" = CASE "status" WHEN 'new' THEN 'pending' WHEN 'out_for_delivery' THEN 'shipped' ELSE "status" END WHERE "status" IN ('new', 'out_for_delivery');--> statement-breakpoint
UPDATE "order_events" SET "from_status" = CASE "from_status" WHEN 'new' THEN 'pending' WHEN 'out_for_delivery' THEN 'shipped' ELSE "from_status" END WHERE "from_status" IN ('new', 'out_for_delivery');--> statement-breakpoint
UPDATE "order_events" SET "to_status" = CASE "to_status" WHEN 'new' THEN 'pending' WHEN 'out_for_delivery' THEN 'shipped' ELSE "to_status" END WHERE "to_status" IN ('new', 'out_for_delivery');--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'shipped', 'delivered', 'postponed', 'refused', 'returned', 'cancelled');--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "from_status" SET DATA TYPE "public"."order_status" USING "from_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" SET DATA TYPE "public"."order_status" USING "to_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."order_status";--> statement-breakpoint
DROP INDEX "order_events_order_idx";--> statement-breakpoint
DROP INDEX "product_images_product_idx";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "area_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "landmark" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "governorate_key" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "eta_min_days" integer;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "eta_max_days" integer;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "courier_name" text;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_title" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "governorate_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "area_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "area_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "landmark" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "placeholder" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "dominant_color" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "renditions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "alt" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "theme_preset" "theme_preset" DEFAULT 'bazaar' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "cover_image_key" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "cover_image_placeholder" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "about" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "return_policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "free_delivery_threshold" integer;--> statement-breakpoint
ALTER TABLE "delivery_areas" ADD CONSTRAINT "delivery_areas_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_areas" ADD CONSTRAINT "delivery_areas_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_image_id_product_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."product_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_areas_zone_idx" ON "delivery_areas" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "delivery_areas_store_idx" ON "delivery_areas" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_store_code_uq" ON "discount_codes" USING btree ("store_id","code");--> statement-breakpoint
CREATE INDEX "product_option_values_option_idx" ON "product_option_values" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "product_options_product_idx" ON "product_options" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_store_sku_uq" ON "product_variants" USING btree ("store_id","sku") WHERE "product_variants"."sku" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_store_idx" ON "push_subscriptions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_governorate_key_governorates_key_fk" FOREIGN KEY ("governorate_key") REFERENCES "public"."governorates"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_governorate_key_governorates_key_fk" FOREIGN KEY ("governorate_key") REFERENCES "public"."governorates"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_area_id_delivery_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."delivery_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_store_status_idx" ON "orders" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","sort");--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_eta_valid" CHECK (("delivery_zones"."eta_min_days" IS NULL OR "delivery_zones"."eta_min_days" >= 0) AND ("delivery_zones"."eta_max_days" IS NULL OR "delivery_zones"."eta_min_days" IS NULL OR "delivery_zones"."eta_max_days" >= "delivery_zones"."eta_min_days"));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_nonneg" CHECK ("orders"."discount_amount" >= 0 AND "orders"."discount_amount" <= "orders"."subtotal");--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_dims_pos" CHECK (("product_images"."width" IS NULL AND "product_images"."height" IS NULL) OR ("product_images"."width" IS NOT NULL AND "product_images"."height" IS NOT NULL AND "product_images"."width" > 0 AND "product_images"."height" > 0));--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_accent_color_hex" CHECK ("stores"."accent_color" IS NULL OR "stores"."accent_color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_free_delivery_pos" CHECK ("stores"."free_delivery_threshold" IS NULL OR "stores"."free_delivery_threshold" > 0);--> statement-breakpoint
-- ---------------------------------------------------------------- backfill (data)
-- Governorates reference data (mirrors src/lib/governorates.ts; tests/migrations.test.ts checks they match).
INSERT INTO "governorates" ("key", "name", "region", "sort") VALUES
  ('erbil', '{"ku": "هەولێر", "ar": "أربيل", "en": "Erbil", "kmr": "Hewlêr"}'::jsonb, 'kurdistan', 0),
  ('sulaymaniyah', '{"ku": "سلێمانی", "ar": "السليمانية", "en": "Sulaymaniyah", "kmr": "Silêmanî"}'::jsonb, 'kurdistan', 1),
  ('duhok', '{"ku": "دهۆک", "ar": "دهوك", "en": "Duhok", "kmr": "Duhok"}'::jsonb, 'kurdistan', 2),
  ('halabja', '{"ku": "هەڵەبجە", "ar": "حلبجة", "en": "Halabja", "kmr": "Helebce"}'::jsonb, 'kurdistan', 3),
  ('kirkuk', '{"ku": "کەرکووک", "ar": "كركوك", "en": "Kirkuk", "kmr": "Kerkûk"}'::jsonb, 'federal', 4),
  ('ninawa', '{"ku": "نەینەوا", "ar": "نينوى", "en": "Nineveh", "kmr": "Neynewa"}'::jsonb, 'federal', 5),
  ('baghdad', '{"ku": "بەغدا", "ar": "بغداد", "en": "Baghdad", "kmr": "Bexda"}'::jsonb, 'federal', 6),
  ('salahaddin', '{"ku": "سەڵاحەدین", "ar": "صلاح الدين", "en": "Saladin", "kmr": "Selahedîn"}'::jsonb, 'federal', 7),
  ('diyala', '{"ku": "دیالە", "ar": "ديالى", "en": "Diyala", "kmr": "Diyala"}'::jsonb, 'federal', 8),
  ('anbar', '{"ku": "ئەنبار", "ar": "الأنبار", "en": "Anbar", "kmr": "Enbar"}'::jsonb, 'federal', 9),
  ('babil', '{"ku": "بابل", "ar": "بابل", "en": "Babil", "kmr": "Babil"}'::jsonb, 'federal', 10),
  ('karbala', '{"ku": "کەربەلا", "ar": "كربلاء", "en": "Karbala", "kmr": "Kerbela"}'::jsonb, 'federal', 11),
  ('najaf', '{"ku": "نەجەف", "ar": "النجف", "en": "Najaf", "kmr": "Necef"}'::jsonb, 'federal', 12),
  ('wasit', '{"ku": "واست", "ar": "واسط", "en": "Wasit", "kmr": "Wasit"}'::jsonb, 'federal', 13),
  ('qadisiyyah', '{"ku": "قادسیە", "ar": "القادسية", "en": "Al-Qadisiyyah", "kmr": "Qadisiye"}'::jsonb, 'federal', 14),
  ('maysan', '{"ku": "مەیسان", "ar": "ميسان", "en": "Maysan", "kmr": "Meysan"}'::jsonb, 'federal', 15),
  ('dhiqar', '{"ku": "زیقار", "ar": "ذي قار", "en": "Dhi Qar", "kmr": "Ziqar"}'::jsonb, 'federal', 16),
  ('muthanna', '{"ku": "موسەننا", "ar": "المثنى", "en": "Muthanna", "kmr": "Musenna"}'::jsonb, 'federal', 17),
  ('basra', '{"ku": "بەسرە", "ar": "البصرة", "en": "Basra", "kmr": "Besra"}'::jsonb, 'federal', 18)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
-- Link existing zones to their governorate (v1 keys were mostly governorates; mosul/zakho were cities).
UPDATE "delivery_zones" SET "governorate_key" = CASE
  WHEN "city_key" IN (SELECT "key" FROM "governorates") THEN "city_key"
  WHEN "city_key" = 'mosul' THEN 'ninawa' WHEN "city_key" = 'zakho' THEN 'duhok'
  ELSE NULL END;--> statement-breakpoint
-- Give every existing store a zone for each governorate it didn't cover yet — inactive, so nothing changes on
-- live storefronts until the seller switches them on.
INSERT INTO "delivery_zones" ("store_id", "city_key", "governorate_key", "name", "fee", "is_active", "sort")
SELECT s."id", g."key", g."key", g."name", f."fee", false, 100 + f."ord"
FROM "stores" s
CROSS JOIN "governorates" g
JOIN (VALUES
  ('erbil', 3000, 0),
  ('sulaymaniyah', 5000, 1),
  ('duhok', 5000, 2),
  ('halabja', 5000, 3),
  ('kirkuk', 5000, 4),
  ('ninawa', 5000, 5),
  ('baghdad', 6000, 6),
  ('salahaddin', 6000, 7),
  ('diyala', 6000, 8),
  ('anbar', 7000, 9),
  ('babil', 6000, 10),
  ('karbala', 7000, 11),
  ('najaf', 7000, 12),
  ('wasit', 7000, 13),
  ('qadisiyyah', 7000, 14),
  ('maysan', 7000, 15),
  ('dhiqar', 7000, 16),
  ('muthanna', 7000, 17),
  ('basra', 7000, 18)
) AS f("key", "fee", "ord") ON f."key" = g."key"
WHERE NOT EXISTS (
  SELECT 1 FROM "delivery_zones" z WHERE z."store_id" = s."id" AND (z."governorate_key" = g."key" OR z."city_key" = g."key")
);--> statement-breakpoint
UPDATE "orders" SET "governorate_key" = CASE
  WHEN "city_key" IN (SELECT "key" FROM "governorates") THEN "city_key"
  WHEN "city_key" = 'mosul' THEN 'ninawa' WHEN "city_key" = 'zakho' THEN 'duhok'
  ELSE NULL END
WHERE "governorate_key" IS NULL;
