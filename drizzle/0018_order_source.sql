-- Social-first attribution (docs/SOCIAL-FIRST.md S4): which platform an order came from (?src=tiktok …). Additive and
-- nullable: older orders and direct visits stay NULL ("direct").
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_store_source_idx" ON "orders" USING btree ("store_id","source");
