ALTER TABLE "stores" ADD COLUMN "showcase_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "stores_showcase_idx" ON "stores" ("updated_at") WHERE "showcase_opt_in" = true;--> statement-breakpoint
UPDATE "stores" SET "showcase_opt_in" = true WHERE "slug" = 'hawler-bazaar';
