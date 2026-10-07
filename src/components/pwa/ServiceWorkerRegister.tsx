"use client";
import { useEffect } from "react";

/**
 * Registers /sw.js in production builds only (dev HMR and a caching worker don't mix).
 * Deliberately dependency-free (no next-intl): it is mounted in the root layout, storefronts included.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
