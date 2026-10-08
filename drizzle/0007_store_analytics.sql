-- Seller analytics: aggregate per-store, per-Iraqi-day, per-page view counters (no visitor-level data).
CREATE TABLE "store_page_views" (
	"store_id" uuid NOT NULL,
	"day" text NOT NULL,
	"page" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "store_page_views_store_id_day_page_pk" PRIMARY KEY("store_id","day","page")
);
--> statement-breakpoint
ALTER TABLE "store_page_views" ADD CONSTRAINT "store_page_views_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;