CREATE TABLE "product_studio_usage" (
	"store_id" uuid NOT NULL,
	"period" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_studio_usage_store_id_period_pk" PRIMARY KEY("store_id","period")
);--> statement-breakpoint
ALTER TABLE "product_studio_usage" ADD CONSTRAINT "product_studio_usage_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
