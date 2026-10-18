-- Owner admin console (docs/ADMIN.md): platform roles, suspensions, admin audit trail, runtime settings
-- (feature flags, maintenance, announcement), per-store limit overrides and time-limited impersonation sessions.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_known" CHECK ("role" IN ('user', 'admin', 'owner'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_known" CHECK ("status" IN ('active', 'suspended', 'banned'));
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "impersonated_by" uuid;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "suspended_reason" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hidden_by_admin_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text,
  "target_label" text,
  "before" jsonb,
  "after" jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_created_idx" ON "admin_audit" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_action_idx" ON "admin_audit" ("action", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_target_idx" ON "admin_audit" ("target_type", "target_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_limit_overrides" (
  "store_id" uuid PRIMARY KEY NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "products" integer,
  "studio_edits" integer,
  "ai_credits" integer,
  "seats" integer,
  "stores" integer,
  "note" text,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_limit_overrides_nonneg" CHECK (coalesce("products", 0) >= 0 AND coalesce("studio_edits", 0) >= 0 AND coalesce("ai_credits", 0) >= 0 AND coalesce("seats", 0) >= 0 AND coalesce("stores", 0) >= 0)
);
