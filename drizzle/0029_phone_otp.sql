-- SF8 Sign in with WhatsApp: one-time login codes. Only a salted sha256 of the code is stored; codes live 5 minutes
-- and allow 5 tries (src/server/services/phone-otp.ts).
CREATE TABLE IF NOT EXISTS "phone_otps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_otps_phone_created_idx" ON "phone_otps" ("phone", "created_at");
