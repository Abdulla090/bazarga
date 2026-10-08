import { createHash, timingSafeEqual } from "node:crypto";

/**
 * `Authorization: Bearer <secret>` check for cron routes, constant-time. No secret configured → never authorised
 * (the route then answers 404 so it doesn't advertise itself).
 */
export function isCronAuthorized(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  const a = createHash("sha256").update(m[1]!).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
