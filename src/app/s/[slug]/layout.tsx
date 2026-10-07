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
  const tagline = pickText(store.tagline, locale);
  const about = pickText(store.about, locale);
  const returns = pickText(store.returnPolicy, locale);
  const theme = resolveTheme(store.themePreset, store.accentColor);
  return (
    <div className="storefront flex min-h-dvh flex-col" data-theme={store.themePreset} style={themeStyle(theme)}>
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="container-page flex min-h-16 items-center gap-3 py-2">
          <Link href={`/s/${store.slug}`} className="me-auto flex min-w-0 items-center gap-3">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-st-hero text-lg font-extrabold text-st-on-hero">{store.name.slice(0, 1)}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-lg font-extrabold">{store.name}</span>
              {tagline && <span className="block truncate text-xs text-ink-70">{tagline}</span>}
            </span>
          </Link>
          <CartLink slug={store.slug} label={t("cart")} />
        </div>
      </header>
      <main className="container-page flex-1 py-6">{children}</main>
      <footer className="border-t border-line bg-white py-6">
        {(about || returns) && (
          <div className="container-page mb-6 grid gap-4 text-sm sm:grid-cols-2">
            {about && (
              <section>
                <h2 className="mb-1 font-bold">{t("about")}</h2>
                <p className="whitespace-pre-line text-ink-70">{about}</p>
              </section>
            )}
            {returns && (
              <section id="returns" className="scroll-mt-24">
                <h2 className="mb-1 font-bold">{t("returnPolicy")}</h2>
                <p className="whitespace-pre-line text-ink-70">{returns}</p>
              </section>
            )}
          </div>
        )}
        <div className="container-page flex flex-wrap items-center justify-between gap-3 text-sm">
          <LocaleSwitcher current={locale} locales={["ku", "ar", "en"]} />
          <div className="flex flex-wrap items-center gap-3 text-ink-70">
            {store.instagram && (
              <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">@{store.instagram}</a>
            )}
            <Link href="/" className="inline-flex items-center gap-1">
              <Awning className="h-3 w-7" /> {t("poweredBy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
