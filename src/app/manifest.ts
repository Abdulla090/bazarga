import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/theme";

/** Web app manifest (/manifest.webmanifest). Kurdish (Sorani, RTL) first, like the rest of the app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bazarga / بازارگە",
    short_name: "بازارگە",
    description: "دوکانی ئۆنلاین بۆ فرۆشیارانی کوردستان — Bazarga",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ku",
    theme_color: BRAND.ink,
    background_color: BRAND.paper,
    categories: ["shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
