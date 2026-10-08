-- COD status flow: remember that an order already put its stock back, so a restock can only ever happen once.
-- Orders already cancelled / returned under the old code were restocked when they got there: mark them, so
-- no later change can put their stock back a second time.
ALTER TABLE "orders" ADD COLUMN "restocked_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "orders" SET "restocked_at" = "updated_at" WHERE "status" IN ('cancelled', 'returned') AND "restocked_at" IS NULL;
