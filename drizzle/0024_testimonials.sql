CREATE TABLE "testimonials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote" text NOT NULL,
  "author" text NOT NULL,
  "role" text,
  "city" text,
  "store_slug" text,
  "approved" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "testimonials_approved_idx" ON "testimonials" ("created_at") WHERE "approved" = true;
