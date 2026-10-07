/**
 * Decide where uploads go (pure — unit tested).
 *
 *  - STORAGE_DRIVER=s3     → S3-compatible bucket; all S3_* values required.
 *  - STORAGE_DRIVER=local  → disk (UPLOAD_DIR, served by /api/files/*).
 *  - unset                 → s3 when a complete bucket config is present, else local disk (dev).
 *
 * Cloudflare R2: S3_ENDPOINT may be omitted when R2_ACCOUNT_ID is set (→ https://<id>.r2.cloudflarestorage.com),
 * and S3_REGION defaults to "auto".
 * Serverless (Vercel/Lambda) has no persistent disk, so the local driver is refused there.
 */
export type StorageConfig =
  | { driver: "local"; uploadDir: string }
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
  STORAGE_DRIVER?: "local" | "s3";
  UPLOAD_DIR: string;
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_PUBLIC_URL?: string;
  R2_ACCOUNT_ID?: string;
}

export function resolveStorageConfig(
  e: StorageEnv,
  runtime: { serverless?: boolean } = {},
): StorageConfig {
  const endpoint = e.S3_ENDPOINT || (e.R2_ACCOUNT_ID ? `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  const missing = (
    [
      ["S3_BUCKET", e.S3_BUCKET],
      ["S3_ACCESS_KEY_ID", e.S3_ACCESS_KEY_ID],
      ["S3_SECRET_ACCESS_KEY", e.S3_SECRET_ACCESS_KEY],
      ["S3_PUBLIC_URL", e.S3_PUBLIC_URL],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const driver = e.STORAGE_DRIVER ?? (missing.length === 0 ? "s3" : "local");

  if (driver === "s3") {
    if (missing.length) throw new Error(`S3/R2 storage requires ${missing.join(", ")}`);
    return {
      driver,
      endpoint,
      region: e.S3_REGION || "auto",
      bucket: e.S3_BUCKET!,
      accessKeyId: e.S3_ACCESS_KEY_ID!,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY!,
      publicUrl: e.S3_PUBLIC_URL!,
    };
  }
  if (runtime.serverless) {
    throw new Error(
      `Local-disk uploads don't persist on serverless hosts. Configure R2/S3 (missing: ${missing.join(", ")}).`,
    );
  }
  return { driver: "local", uploadDir: e.UPLOAD_DIR };
}
