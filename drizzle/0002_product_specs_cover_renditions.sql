ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "specs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "cover_image_renditions" jsonb DEFAULT '[]'::jsonb NOT NULL;