-- Team members (Pro 2 / Business 5 / Max 10 seats, src/lib/plans.ts TEAM_LIMIT). The owner is stores.owner_id, never a row here.
CREATE TABLE IF NOT EXISTS "store_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role" text DEFAULT 'staff' NOT NULL,
  "token_hash" text,
  "invited_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "invited_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  CONSTRAINT "store_members_role_ck" CHECK ("role" IN ('staff'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_members_store_email_uq" ON "store_members" ("store_id", "email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_members_token_uq" ON "store_members" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_members_user_idx" ON "store_members" ("user_id");
