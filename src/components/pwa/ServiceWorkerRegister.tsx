"use client";
import { useEffect } from "react";

/**
 * Registers /sw.js in production builds only (dev HMR and a caching worker don't mix).
 * Deliberately dependency-free (no next-intl): it is mounted in the root layout, storefronts included.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // updateViaCache "none" + update(): a returning phone checks for a new sw.js on every visit instead of trusting
    // an HTTP-cached copy, so a worker change (cache version bump) reaches it right away.
    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => reg.update())
        .catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
