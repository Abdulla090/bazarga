"use client";
import { useEffect } from "react";
import { captureSource } from "@/lib/source-client";
import { sourceStorageKey } from "@/lib/social";

/**
 * Mounted once in the storefront layout. When the page was opened from a shared link with `?src=<platform>`, it
 * remembers the platform for checkout (src/lib/source-client.ts), counts one social arrival for seller analytics
 * (`/api/v/<slug>?s=<platform>`, once per tab session per platform) and removes `src` from the address bar so a
 * shopper who re-shares the page does not pass the seller's TikTok attribution on. Renders nothing.
 */
export function SourceCapture({ slug }: { slug: string }) {
  useEffect(() => {
    const src = captureSource(slug, window.location.search);
    if (!src) return;
    try {
      const flag = `${sourceStorageKey(slug)}:counted:${src}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        // Same 1×1 GIF beacon as ViewPixel (an image request: no CORS, no credentials needed, never blocks navigation).
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.src = `/api/v/${slug}?s=${src}`;
      }
    } catch {
      /* counting must never break the page */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("src");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {}
  }, [slug]);
  return null;
}
