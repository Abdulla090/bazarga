-- AI credits per store per month (Asia/Baghdad "YYYY-MM"): feature = 'aiDescriptions' | 'aiDesigner'. Limits in src/lib/plans.ts AI_MONTHLY_LIMIT.
CREATE TABLE IF NOT EXISTS "ai_usage" (
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "feature" text NOT NULL,
  "period" text NOT NULL,
  "used" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_usage_store_id_feature_period_pk" PRIMARY KEY("store_id","feature","period")
);
