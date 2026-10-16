ALTER TABLE "stores" ADD COLUMN "founding_number" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "stores_founding_number_uq" ON "stores" ("founding_number") WHERE "founding_number" IS NOT NULL;
