import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { CartLink } from "@/components/store/CartLink";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Awning } from "@/components/Logo";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { resolveTheme, themeStyle } from "@/lib/theme";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStore(slug);
  const locale = await currentLocale();
  return {
    title: { absolute: store.name },
    description: pickText(store.tagline, locale) || store.name,
    openGraph: { title: store.name, images: store.logoUrl ? [store.logoUrl] : undefined },
  };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const about = pickText(store.about, locale);
  const returns = pickText(store.returnPolicy, locale);
  const theme = resolveTheme(store.themePreset, store.accentColor);
  return (
    <div className="storefront flex min-h-dvh flex-col" data-theme={store.themePreset} style={themeStyle(theme)}>
      <header className="store-header sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="container-page flex h-16 items-center gap-3">
          <Link href={`/s/${store.slug}`} className="me-auto flex min-h-11 min-w-0 items-center gap-2.5">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-st-fg text-xs font-medium text-st-bg">{store.name.slice(0, 1)}</span>
            )}
            <span className="truncate text-[15px] font-medium">{store.name}</span>
          </Link>
          <CartLink slug={store.slug} label={t("cart")} />
        </div>
      </header>
      <main className="container-page flex-1 pt-6 pb-14 sm:pt-10 sm:pb-24">{children}</main>
      <footer className="border-t border-st-border py-10 text-sm">
        {(about || returns) && (
          <div className="container-page mb-8 grid gap-8 sm:grid-cols-2">
            {about && (
              <section className="max-w-prose">
                <h2 className="mb-2 text-[13px] font-medium text-muted">{t("about")}</h2>
                <p className="whitespace-pre-line leading-relaxed">{about}</p>
              </section>
            )}
            {returns && (
              <section id="returns" className="max-w-prose scroll-mt-24">
                <h2 className="mb-2 text-[13px] font-medium text-muted">{t("returnPolicy")}</h2>
                <p className="whitespace-pre-line leading-relaxed">{returns}</p>
              </section>
            )}
          </div>
        )}
        <div className="container-page flex flex-wrap items-center justify-between gap-3">
          <LocaleSwitcher current={locale} locales={["ku", "ar", "en", "kmr"]} />
          <div className="flex flex-wrap items-center gap-4 text-muted">
            {store.instagram && (
              <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-st-fg" dir="ltr">@{store.instagram}</a>
            )}
            <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 hover:text-st-fg">
              <Awning className="h-3 w-7" /> {t("poweredBy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
