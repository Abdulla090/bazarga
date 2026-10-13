-- Rasedi (unified gateway) payments: subscriptions + marketplace storefront orders. Additive only.
-- With PAYMENTS_PROVIDER unset/none nothing writes to these tables and the 'online' method is never offered.
ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'online';--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid,
	"upgrade_request_id" uuid,
	"provider" text NOT NULL,
	"provider_ref" text,
	"amount_iqd" integer NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"gateway" text,
	"checkout_url" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"commission_iqd" integer DEFAULT 0 NOT NULL,
	"check_count" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_kind_chk" CHECK ("payments"."kind" IN ('subscription', 'order')),
	CONSTRAINT "payments_status_chk" CHECK ("payments"."status" IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
	CONSTRAINT "payments_amount_pos" CHECK ("payments"."amount_iqd" > 0 AND "payments"."commission_iqd" >= 0 AND "payments"."commission_iqd" <= "payments"."amount_iqd"),
	CONSTRAINT "payments_kind_link" CHECK (("payments"."kind" = 'order' AND "payments"."order_id" IS NOT NULL) OR ("payments"."kind" = 'subscription' AND "payments"."order_id" IS NULL))
);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_upgrade_request_id_fk" FOREIGN KEY ("upgrade_request_id") REFERENCES "public"."upgrade_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "payments_store_created_idx" ON "payments" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"provider_ref" text,
	"payment_id" uuid,
	"status" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outcome" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_uq" ON "payment_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE TABLE "seller_payout_profiles" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"account_name" text NOT NULL,
	"account_identifier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_payout_method_chk" CHECK ("seller_payout_profiles"."method" IN ('fib', 'zaincash', 'bank')),
	CONSTRAINT "seller_payout_status_chk" CHECK ("seller_payout_profiles"."status" IN ('pending', 'verified', 'rejected'))
);--> statement-breakpoint
ALTER TABLE "seller_payout_profiles" ADD CONSTRAINT "seller_payout_profiles_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"amount_iqd" integer NOT NULL,
	"method" text NOT NULL,
	"account_identifier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payouts_amount_pos" CHECK ("payouts"."amount_iqd" > 0),
	CONSTRAINT "payouts_status_chk" CHECK ("payouts"."status" IN ('pending', 'paid', 'cancelled'))
);--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payouts_store_created_idx" ON "payouts" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"account" text NOT NULL,
	"entry_type" text NOT NULL,
	"amount_iqd" integer NOT NULL,
	"payment_id" uuid,
	"payout_id" uuid,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_account_chk" CHECK ("ledger_entries"."account" IN ('seller', 'platform')),
	CONSTRAINT "ledger_type_chk" CHECK ("ledger_entries"."entry_type" IN ('sale', 'commission', 'commission_income', 'payout', 'refund'))
);--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payout_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_payment_type_uq" ON "ledger_entries" USING btree ("payment_id","account","entry_type");--> statement-breakpoint
CREATE INDEX "ledger_store_idx" ON "ledger_entries" USING btree ("store_id","account","created_at");
