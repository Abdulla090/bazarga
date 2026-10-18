"use client";
import { useEffect } from "react";
import { setPreviewTagline } from "./HeroTagline";

/** Inside the Theme Studio iframe only: applies theme CSS vars posted by the same-origin editor, no reload. */
export function PreviewBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const root = document.querySelector<HTMLElement>(".storefront");
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !root) return;
      const d = e.data as { type?: string; vars?: Record<string, string>; header?: { layout?: string; announce?: string }; tagline?: string };
      if (d?.type !== "bazarga-theme" || !d.vars) return;
      if (d.header) {
        if (["centered", "split", "minimal"].includes(d.header.layout ?? "")) root.dataset.header = d.header.layout;
        const bar = document.getElementById("announce-bar");
        if (bar) { const txt = String(d.header.announce ?? "").slice(0, 80); bar.textContent = txt; bar.hidden = !txt; }
      }
      // AI Website Designer draft tagline (SF10): rendered by HeroTagline (React state, not DOM edits).
      if (typeof d.tagline === "string") setPreviewTagline(d.tagline || null);
      for (const [k, v] of Object.entries(d.vars)) if (/^--(t|st)-[a-z-]+$/.test(k) && typeof v === "string") root.style.setProperty(k, v);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "bazarga-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  return null;
}
