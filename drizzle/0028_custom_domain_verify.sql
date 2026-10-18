-- SF7 custom domains (Business+): stores.custom_domain already exists (0000, unique). A domain serves the store only once DNS is verified.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "custom_domain_verified_at" timestamp with time zone;
