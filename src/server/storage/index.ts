import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";
import { logger } from "../logger";
import { storeImage, type StoredImage } from "./pipeline";
import { resolveStorageConfig } from "./config";

export interface StorageAdapter {
  readonly name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_.-]+$/;
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.startsWith("/")) throw new Error("unsafe storage key");
}

/** Dev / single-VPS adapter: files on disk, served by /api/files/[...key]. Mount UPLOAD_DIR as a volume. */
export class LocalDiskStorage implements StorageAdapter {
  readonly name = "local";
  constructor(private root: string) {}
  private full(key: string) {
    assertSafeKey(key);
    return path.join(path.resolve(this.root), key);
  }
  async put(key: string, body: Uint8Array) {
    const p = this.full(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
    return { key, url: `/api/files/${key}` };
  }
  async read(key: string): Promise<Buffer> {
    return readFile(this.full(key));
  }
  async delete(key: string) {
    await unlink(this.full(key)).catch(() => undefined);
  }
}

/** S3-compatible object storage (Cloudflare R2, AWS S3, MinIO, Backblaze B2…). */
export class S3Storage implements StorageAdapter {
  readonly name = "s3";
  private client: S3Client;
  constructor(
    private cfg: { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicUrl: string },
  ) {
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: !!cfg.endpoint,
      // R2 / MinIO / B2 don't implement every flexible-checksum header newer AWS SDKs send by default.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key, url: `${this.cfg.publicUrl.replace(/\/$/, "")}/${key}` };
  }
  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
}

/** Supabase Storage over its REST API (public bucket, created on first write). Free-tier friendly, no S3 keys needed. */
export class SupabaseStorage implements StorageAdapter {
  readonly name = "supabase";
  private ready?: Promise<void>;
  constructor(private cfg: { url: string; serviceKey: string; bucket: string }) {}
  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.cfg.serviceKey}`, apikey: this.cfg.serviceKey, ...extra };
  }
  private ensureBucket() {
    this.ready ??= (async () => {
      const r = await fetch(`${this.cfg.url}/storage/v1/bucket`, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: this.cfg.bucket, name: this.cfg.bucket, public: true }),
      });
      if (!r.ok && r.status !== 409 && !(await r.clone().text()).includes("already exists")) {
        this.ready = undefined;
        throw new Error(`supabase bucket create failed (${r.status})`);
      }
    })();
    return this.ready;
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    assertSafeKey(key);
    await this.ensureBucket();
    const r = await fetch(`${this.cfg.url}/storage/v1/object/${this.cfg.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType, "Cache-Control": "max-age=31536000", "x-upsert": "true" }),
      body: Buffer.from(body),
    });
    if (!r.ok) throw new Error(`supabase upload failed (${r.status})`);
    return { key, url: `${this.cfg.url}/storage/v1/object/public/${this.cfg.bucket}/${key}` };
  }
  async delete(key: string) {
    assertSafeKey(key);
    await fetch(`${this.cfg.url}/storage/v1/object/${this.cfg.bucket}/${key}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }
}

let adapter: StorageAdapter | undefined;
export function storage(): StorageAdapter {
  if (adapter) return adapter;
  const cfg = resolveStorageConfig(env(), { serverless: !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME });
  if (cfg.driver === "supabase" && cfg.fallbackFrom) logger.warn("storage.fallback", { wanted: "s3", using: "supabase" });
  adapter =
    cfg.driver === "supabase" ? new SupabaseStorage(cfg) : cfg.driver === "s3" ? new S3Storage(cfg) : new LocalDiskStorage(cfg.uploadDir);
  return adapter;
}

/**
 * Seller image upload through the pipeline (./pipeline.ts): validated, EXIF/GPS-stripped, resized to WebP
 * renditions with dimensions + placeholder, written via whichever adapter is configured (disk or S3/R2).
 */
export async function uploadProcessedImage(storeId: string, file: File): Promise<StoredImage> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return storeImage(storage(), storeId, buf, { maxMb: env().MAX_UPLOAD_MB });
}
