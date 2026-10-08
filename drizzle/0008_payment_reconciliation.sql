-- Payment reconciliation + abandoned-order expiry: per-attempt check bookkeeping, order expiry stamp.
ALTER TABLE "orders" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "check_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_tx_status_created_idx" ON "payment_transactions" USING btree ("status","created_at");