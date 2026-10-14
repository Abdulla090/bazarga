/**
 * Checkout idempotency keys. The browser mints one key per checkout attempt and sends it with the order; the server
 * stores it on the order (unique per store, migration 0015), so a retried request — a flaky network that lost the
 * response, a double submit, a back-button resubmit — returns the order it already created instead of a second one.
 */
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function isIdempotencyKey(v: unknown): v is string {
  return typeof v === "string" && IDEMPOTENCY_KEY_RE.test(v);
}

/** 128 random bits as base64url (22 chars). Uses getRandomValues, which (unlike randomUUID) also works on plain http. */
export function newIdempotencyKey(cryptoImpl: Pick<Crypto, "getRandomValues"> = globalThis.crypto): string {
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
