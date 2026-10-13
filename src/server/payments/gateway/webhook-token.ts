import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time compare of the `token` query parameter of a webhook URL against the configured secret. */
export function webhookTokenOk(url: string, secret: string): boolean {
  let token: string | null = null;
  try {
    token = new URL(url, "http://local").searchParams.get("token");
  } catch {
    return false;
  }
  if (!token || !secret) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
