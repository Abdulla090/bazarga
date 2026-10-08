ALTER TABLE "discount_codes" ADD COLUMN "show_on_storefront" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "badge" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_badge_known" CHECK ("products"."badge" IS NULL OR "products"."badge" IN ('new', 'featured'));