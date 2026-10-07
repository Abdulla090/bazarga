import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { fontVariables } from "./fonts";
import { HTML_LANG, dirOf, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { BRAND } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: { default: t("metaTitle"), template: "%s · my market" },
    description: t("metaDescription"),
    applicationName: "my market",
    icons: { icon: "/icon.svg" },
  };
}

/**
 * Every route renders per request (connection() below), so the Cache Components static-shell / instant-navigation
 * validation does not apply app-wide: data caching happens in the data layer (src/server/cache) instead.
 */
export const instant = false;

export const viewport: Viewport = { themeColor: BRAND.ink, width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce-based CSP (src/proxy.ts) needs every page rendered per request: Next stamps the nonce from the
  // request's CSP header onto its scripts at render time. A statically prerendered page would ship un-nonced
  // scripts that the browser blocks.
  await connection();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const messages = await getMessages();
  return (
    <html lang={HTML_LANG[locale]} dir={dirOf(locale)} className={fontVariables}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
