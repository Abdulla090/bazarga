import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * In-memory, per-instance de-duplication of page views: "has this visitor already been counted on this page of this
 * store today?". The key is a SHA-256 of a random salt that is regenerated every Iraqi day plus IP + user agent +
 * store + page, so nothing that identifies a person is kept, and yesterday's keys can't be linked to today's.
 * Bounded: when the set is full it is cleared (worst case a few extra views are counted, never an error).
 */
const MAX_KEYS = 100_000;

let day = "";
let salt = randomBytes(16);
const seen = new Set<string>();

export function firstSeen(today: string, parts: string[]): boolean {
  if (today !== day) {
    day = today;
    salt = randomBytes(16);
    seen.clear();
  }
  const h = createHash("sha256").update(salt);
  for (const p of parts) h.update("\u0000").update(p);
  const key = h.digest("base64url").slice(0, 22);
  if (seen.has(key)) return false;
  if (seen.size >= MAX_KEYS) seen.clear();
  seen.add(key);
  return true;
}

/** Tests only. */
export function _resetDedupe() {
  day = "";
  seen.clear();
}
