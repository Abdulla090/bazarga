ALTER TABLE "products" ADD COLUMN "short_code" text DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8) NOT NULL;--> statement-breakpoint
UPDATE "products" SET "short_code" = substr(md5(id::text), 1, 8);--> statement-breakpoint
CREATE UNIQUE INDEX "products_short_code_unique" ON "products" USING btree ("short_code");
