import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getStoreForOwner } from "@/server/services/stores";
import { createStoreAction } from "@/server/actions/dashboard";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { Logo } from "@/components/Logo";
import { THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";
import { applyPresetAction } from "./actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { IRAQI_CITIES } from "@/lib/cities";
import { DEFAULT_LOCALE, isLocale, pickText } from "@/lib/i18n";
import { currentLocale } from "@/server/locale";

export const metadata = { title: "Set up your store" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  const step = (await searchParams).step;
  const existing = await getStoreForOwner(db(), user.id);
  if (existing && step !== "theme") redirect("/dashboard");
  const t = await getTranslations("onboarding");
  const ts = await getTranslations("themeStudio");
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  if (existing) {
    return (
      <div className="min-h-dvh">
        <header className="container-page flex items-center justify-between py-4">
          <Logo />
          <LocaleSwitcher current={await currentLocale()} locales={["ku", "ar", "en"]} />
        </header>
        <main className="container-page max-w-3xl py-6">
          <h1 className="text-3xl font-extrabold">{t("themeTitle")}</h1>
          <p className="mb-6 text-ink-70">{t("themeSub")}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.values(THEME_STUDIO_PRESETS).map((p) => (
              <li key={p.preset} className="rounded-xl border border-ink-10 p-3" style={{ background: p.colors.bg, color: p.colors.text }}>
                <div className="mb-3 h-16 rounded-lg" style={{ background: p.colors.surface, borderBottom: `4px solid ${p.colors.accent}` }} />
                <p className="mb-2 font-bold">{ts(`preset.${p.preset}`)}</p>
                <form action={applyPresetAction}>
                  <input type="hidden" name="preset" value={p.preset} />
                  <button type="submit" className="min-h-11 w-full rounded-full px-3 text-sm font-bold" style={{ background: p.colors.accent, color: p.colors.bg }}>
                    {t("themeUse")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <a href="/dashboard" className="mt-6 inline-flex min-h-11 items-center text-ink-70 underline">{t("themeSkip")}</a>
        </main>
      </div>
    );
  }
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
