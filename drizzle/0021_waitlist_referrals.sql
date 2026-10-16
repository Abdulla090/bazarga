ALTER TABLE "waitlist" ADD COLUMN "seq" bigint GENERATED ALWAYS AS IDENTITY;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "ref_code" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "referred_by" uuid;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "referral_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "waitlist" SET "ref_code" = upper(substr(md5("id"::text), 1, 8)) WHERE "ref_code" IS NULL;--> statement-breakpoint
ALTER TABLE "waitlist" ALTER COLUMN "ref_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_ref_code_uq" ON "waitlist" ("ref_code");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_seq_uq" ON "waitlist" ("seq");--> statement-breakpoint
CREATE INDEX "waitlist_whatsapp_idx" ON "waitlist" ("whatsapp");
