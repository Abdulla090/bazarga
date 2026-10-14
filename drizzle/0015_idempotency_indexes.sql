-- Launch hardening (additive only): checkout idempotency key + indexes for the hot queries found in review.
-- Plain CREATE INDEX (drizzle runs each migration in a transaction); all tables are small at launch.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_store_idempotency_uq" ON "orders" USING btree ("store_id","idempotency_key") WHERE "orders"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_unpaid_online_created_idx" ON "orders" USING btree ("created_at") WHERE "orders"."status" = 'pending' AND "orders"."payment_method" <> 'cod' AND "orders"."expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_store_last_order_idx" ON "customers" USING btree ("store_id","last_order_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_store_sort_idx" ON "products" USING btree ("store_id","sort","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stores_paid_period_end_idx" ON "stores" USING btree ("plan_period_end") WHERE "stores"."plan" <> 'free';
