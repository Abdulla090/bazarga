"use client";
import { useEffect } from "react";

/** Inside the Theme Studio iframe only: applies theme CSS vars posted by the same-origin editor, no reload. */
export function PreviewBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const root = document.querySelector<HTMLElement>(".storefront");
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !root) return;
      const d = e.data as { type?: string; vars?: Record<string, string> };
      if (d?.type !== "bazarga-theme" || !d.vars) return;
      for (const [k, v] of Object.entries(d.vars)) if (/^--(t|st)-[a-z-]+$/.test(k) && typeof v === "string") root.style.setProperty(k, v);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "bazarga-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  return null;
}
