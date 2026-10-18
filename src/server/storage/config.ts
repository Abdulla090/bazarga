/**
 * Decide where uploads go (pure — unit tested).
 *
 *  - STORAGE_DRIVER=s3     → S3-compatible bucket; all S3_* values required.
 *  - STORAGE_DRIVER=local  → disk (UPLOAD_DIR, served by /api/files/*).
 *  - unset                 → s3 when a complete bucket config is present, else local disk (dev).
 *
 * Cloudflare R2: S3_ENDPOINT may be omitted when R2_ACCOUNT_ID is set (→ https://<id>.r2.cloudflarestorage.com),
 * and S3_REGION defaults to "auto". Every S3_* bucket value also has an R2_* alias (R2_BUCKET, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL); S3_* wins when both are set. STORAGE_DRIVER=r2 is an alias of s3.
 *
 * Fallback: when s3/r2 is forced but incomplete and Supabase Storage is configured, uploads go to Supabase instead
 * of failing (the result carries `fallbackFrom: "s3"` so /api/health and the log can say so). Without Supabase the
 * forced driver still throws and names the missing values.
 * Serverless (Vercel/Lambda) has no persistent disk, so the local driver is refused there.
 */
export type StorageConfig =
  | { driver: "local"; uploadDir: string }
  | { driver: "supabase"; url: string; serviceKey: string; bucket: string; fallbackFrom?: "s3" }
  | {
      driver: "s3";
      endpoint?: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicUrl: string;
    };

export interface StorageEnv {
  STORAGE_DRIVER?: "local" | "s3" | "r2" | "supabase";
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_BUCKET?: string;
  UPLOAD_DIR: string;
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_PUBLIC_URL?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_PUBLIC_URL?: string;
}

export function resolveStorageConfig(
  e: StorageEnv,
  runtime: { serverless?: boolean } = {},
): StorageConfig {
  const endpoint = e.S3_ENDPOINT || (e.R2_ACCOUNT_ID ? `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  const bucket = e.S3_BUCKET || e.R2_BUCKET;
  const accessKeyId = e.S3_ACCESS_KEY_ID || e.R2_ACCESS_KEY_ID;
  const secretAccessKey = e.S3_SECRET_ACCESS_KEY || e.R2_SECRET_ACCESS_KEY;
  const publicUrl = e.S3_PUBLIC_URL || e.R2_PUBLIC_URL;
  const missing = (
    [
      ["S3_BUCKET", bucket],
      ["S3_ACCESS_KEY_ID", accessKeyId],
      ["S3_SECRET_ACCESS_KEY", secretAccessKey],
      ["S3_PUBLIC_URL", publicUrl],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const sbReady = !!(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY);
  const forced = e.STORAGE_DRIVER === "r2" ? "s3" : e.STORAGE_DRIVER;
  let driver = forced ?? (missing.length === 0 ? "s3" : sbReady && runtime.serverless ? "supabase" : "local");
  let fallbackFrom: "s3" | undefined;
  if (driver === "s3" && missing.length && sbReady) {
    driver = "supabase";
    fallbackFrom = "s3";
  }

  if (driver === "supabase") {
    if (!sbReady) throw new Error("Supabase storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    return { driver, url: e.SUPABASE_URL!.replace(/\/$/, ""), serviceKey: e.SUPABASE_SERVICE_ROLE_KEY!, bucket: e.SUPABASE_BUCKET || "uploads", ...(fallbackFrom ? { fallbackFrom } : {}) };
  }

  if (driver === "s3") {
    if (missing.length) throw new Error(`S3/R2 storage requires ${missing.join(", ")}`);
    return {
      driver,
      endpoint,
      region: e.S3_REGION || "auto",
      bucket: bucket!,
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      publicUrl: publicUrl!,
    };
  }
  if (runtime.serverless) {
    throw new Error(
      `Local-disk uploads don't persist on serverless hosts. Configure R2/S3 (missing: ${missing.join(", ")}).`,
    );
  }
  return { driver: "local", uploadDir: e.UPLOAD_DIR };
}
