import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { currentLocale } from "@/server/locale";

/**
 * Client-side translations for the seller app (dashboard, auth, onboarding, landing).
 * The storefront deliberately does NOT use it: shoppers on Iraqi mobile data get pre-translated strings as props
 * instead of the i18n runtime (~12 KB gzip of JS) and the whole message catalogue inlined into every page.
 */
export async function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([currentLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
