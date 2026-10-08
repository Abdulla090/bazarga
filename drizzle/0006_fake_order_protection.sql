-- Fake-order protection (COD): per-store phone blocklist, risk flags shown to the seller, cart fingerprint for duplicate detection.
CREATE TABLE "store_blocked_phones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cart_hash" text;--> statement-breakpoint
ALTER TABLE "store_blocked_phones" ADD CONSTRAINT "store_blocked_phones_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_blocked_phones_store_phone_uq" ON "store_blocked_phones" USING btree ("store_id","phone");--> statement-breakpoint
CREATE INDEX "orders_store_phone_created_idx" ON "orders" USING btree ("store_id","customer_phone","created_at");