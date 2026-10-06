import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/inter";
import "./globals.css";
import { HTML_LANG, dirOf, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: { default: t("metaTitle"), template: "%s · my market" },
    description: t("metaDescription"),
    applicationName: "my market",
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#0F1B2D", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const messages = await getMessages();
  return (
    <html lang={HTML_LANG[locale]} dir={dirOf(locale)}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
