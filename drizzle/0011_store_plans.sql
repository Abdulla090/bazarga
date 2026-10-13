ALTER TABLE "stores" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "plan_period_end" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "store_plan_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"from_plan" text NOT NULL,
	"to_plan" text NOT NULL,
	"period_end" timestamp with time zone,
	"reason" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "store_plan_history" ADD CONSTRAINT "store_plan_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "stores" SET "plan" = 'pro' WHERE "slug" = 'hawler-bazaar';
