import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { fontVariables } from "./fonts";
import { HTML_LANG, dirOf, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { BRAND } from "@/lib/theme";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: { default: t("metaTitle"), template: "%s · Bazarga" },
    description: t("metaDescription"),
    applicationName: "Bazarga",
    icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "بازارگە", statusBarStyle: "default" },
  };
}

/**
 * Every route renders per request (connection() below), so the Cache Components static-shell / instant-navigation
 * validation does not apply app-wide: data caching happens in the data layer (src/server/cache) instead.
 */
export const instant = false;

export const viewport: Viewport = { themeColor: BRAND.ink, width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce-based CSP (src/proxy.ts) needs every page rendered per request: Next stamps the nonce from the
  // request's CSP header onto its scripts at render time. A statically prerendered page would ship un-nonced
  // scripts that the browser blocks.
  await connection();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <html lang={HTML_LANG[locale]} dir={dirOf(locale)} className={fontVariables}>
      <body className="antialiased">
        {/* Client translations are provided per area (src/components/IntlProvider.tsx), not here: storefronts ship none. */}
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
