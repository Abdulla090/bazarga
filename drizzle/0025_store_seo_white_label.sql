-- Advanced SEO + white-label (Max plan): per-store meta/OG overrides, product meta overrides, white-label switch.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "white_label" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;
