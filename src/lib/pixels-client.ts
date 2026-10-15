/**
 * Zod-free pixel helpers shared with the storefront bundle (zod would add ~15 KB gzip to every store page).
 * Server-side validation lives in ./pixels.ts.
 */
export const PIXEL_EVENTS = ["ViewContent", "AddToCart", "Purchase"] as const;
export type PixelEvent = (typeof PIXEL_EVENTS)[number];
export type PixelData = { value?: number; currency?: string; ids?: string[]; name?: string; quantity?: number };

/** Respect the browser's privacy signals: no pixels when Do Not Track or Global Privacy Control is on. */
export function trackingAllowed(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined): boolean {
  if (!nav) return false;
  if (nav.doNotTrack === "1" || nav.doNotTrack === "yes") return false;
  if (nav.globalPrivacyControl === true) return false;
  return true;
}

/** Vendor event name + parameters. TikTok has no "Purchase": a paid order is `CompletePayment` there. */
export function vendorEvent(vendor: "tiktok" | "meta", event: PixelEvent, d: PixelData = {}) {
  const base: Record<string, unknown> = { content_type: "product", currency: d.currency ?? "IQD" };
  if (d.value !== undefined) base.value = d.value;
  if (d.ids?.length) base.content_ids = d.ids;
  if (d.name) base.content_name = d.name;
  if (d.quantity !== undefined) base.quantity = d.quantity;
  if (vendor === "tiktok") {
    const name = event === "Purchase" ? "CompletePayment" : event;
    // TikTok wants `contents` for catalog matching; keep it flat and PII-free.
    const contents = (d.ids ?? []).map((id) => ({ content_id: id, content_type: "product", content_name: d.name }));
    return { name, params: { ...base, ...(contents.length ? { contents } : {}) } };
  }
  return { name: event, params: base };
}

/** Browser-side script bodies are fixed strings; only the (validated) ID is interpolated, and only after a re-check. */
export function safePixelId(vendor: "tiktok" | "meta", id: string | null | undefined): string | null {
  if (!id) return null;
  const v = id.trim();
  if (vendor === "tiktok") return /^[A-Za-z0-9]{8,32}$/.test(v) ? v.toUpperCase() : null;
  return /^\d{8,20}$/.test(v) ? v : null;
}
