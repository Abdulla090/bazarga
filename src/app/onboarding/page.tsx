import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getStoreForOwner } from "@/server/services/stores";
import { createStoreAction } from "@/server/actions/dashboard";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { IRAQI_CITIES } from "@/lib/cities";
import { DEFAULT_LOCALE, isLocale, pickText } from "@/lib/i18n";
import { currentLocale } from "@/server/locale";

export const metadata = { title: "Set up your store" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getStoreForOwner(db(), user.id)) redirect("/dashboard");
  const t = await getTranslations("onboarding");
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return (
    <div className="min-h-dvh">
      <header className="container-page flex items-center justify-between py-4">
        <Logo />
        <LocaleSwitcher current={await currentLocale()} locales={["ku", "ar", "en"]} />
      </header>
      <main className="container-page max-w-xl py-6">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mb-6 text-ink-70">{t("sub")}</p>
        <StoreForm
          action={createStoreAction}
          mode="create"
          rootDomain={new URL(env().APP_URL).host}
          initial={{ name: "", slug: "", defaultLocale: locale, phone: null, whatsapp: null, instagram: null, city: "erbil" }}
          cities={IRAQI_CITIES.map((c) => ({ key: c.key, name: pickText(c.name, locale) }))}
        />
      </main>
    </div>
  );
}
