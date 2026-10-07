import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";
import { validateImage } from "./image";
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

let adapter: StorageAdapter | undefined;
export function storage(): StorageAdapter {
  if (adapter) return adapter;
  const cfg = resolveStorageConfig(env(), { serverless: !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME });
  adapter = cfg.driver === "s3" ? new S3Storage(cfg) : new LocalDiskStorage(cfg.uploadDir);
  return adapter;
}

/** Validate (magic bytes + size) and store a seller's image under their store prefix. */
export async function uploadStoreImage(storeId: string, file: File): Promise<{ key: string; url: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const t = validateImage(buf, env().MAX_UPLOAD_MB);
  const key = `stores/${storeId}/${randomUUID()}.${t.ext}`;
  return storage().put(key, buf, t.mime);
}
