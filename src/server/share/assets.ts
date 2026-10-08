import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { resolveStorageConfig } from "../storage/config";
import { LocalDiskStorage, storage } from "../storage";
import { logger } from "../logger";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Where a store image URL may be read from for server-side rendering. Only the store's OWN uploads
 * (`stores/<storeId>/…`, local disk or the configured S3 public URL) and the app's bundled `/images/*` —
 * never an arbitrary URL (no SSRF, no reading another tenant's files).
 */
export type ImageSource =
  | { kind: "local"; key: string }
  | { kind: "remote"; url: string }
  | { kind: "public"; file: string }
  | null;

const KEY_RE = /^stores\/[0-9a-f-]{36}\/[0-9a-f-]{36}(-\d{2,5})?\.(jpg|png|webp)$/;

export function imageSourceFor(url: string | null | undefined, storeId: string, s3PublicUrl?: string | null): ImageSource {
  if (!url) return null;
  if (url.startsWith("/api/files/")) {
    const key = url.slice("/api/files/".length);
    return KEY_RE.test(key) && key.startsWith(`stores/${storeId}/`) ? { kind: "local", key } : null;
  }
  if (s3PublicUrl) {
    const base = `${s3PublicUrl.replace(/\/+$/, "")}/`;
    if (url.startsWith(base)) {
      const key = url.slice(base.length);
      return KEY_RE.test(key) && key.startsWith(`stores/${storeId}/`) ? { kind: "remote", url } : null;
    }
  }
  if (/^\/images\/[a-z0-9/_-]+\.(jpg|png|webp)$/i.test(url) && !url.includes("..")) return { kind: "public", file: url.slice(1) };
  return null;
}

/** Bytes of the store's logo (or null: missing, foreign, too big, unreachable). Never throws. */
export async function loadStoreImage(url: string | null | undefined, storeId: string): Promise<Uint8Array | null> {
  let publicUrl: string | null = null;
  try {
    const cfg = resolveStorageConfig(env());
    publicUrl = cfg.driver === "s3" ? cfg.publicUrl : null;
  } catch {
    publicUrl = null;
  }
  const src = imageSourceFor(url, storeId, publicUrl);
  if (!src) return null;
  try {
    if (src.kind === "local") {
      const s = storage();
      if (!(s instanceof LocalDiskStorage)) return null;
      const buf = await s.read(src.key);
      return buf.length <= MAX_BYTES ? new Uint8Array(buf) : null;
    }
    if (src.kind === "public") {
      const buf = await readFile(path.join(process.cwd(), "public", src.file));
      return buf.length <= MAX_BYTES ? new Uint8Array(buf) : null;
    }
    const res = await fetch(src.url, { signal: AbortSignal.timeout(4000), redirect: "error" });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.length <= MAX_BYTES ? buf : null;
  } catch (err) {
    logger.warn("share.image_unavailable", { storeId, err });
    return null;
  }
}
