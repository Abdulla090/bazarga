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
import { normalizePhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";

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
  const wa = store.whatsapp ? normalizePhone(store.whatsapp) : null;
  const colHead = "t-label mb-3 text-muted";
  return (
    <div className="storefront flex min-h-dvh flex-col" data-theme={store.themePreset} style={themeStyle(theme)}>
      <header className="store-header sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="store-page flex h-16 items-center gap-3">
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
      <main className="store-page flex-1 pt-6 sm:pt-10">{children}</main>
      {/* Sign-off: the store name set very large and faint as a closing statement (Layout v3 §8). */}
      <div className="store-page section pb-6 sm:pb-8" aria-hidden data-testid="sign-off">
        <p className="t-hero select-none break-words text-st-fg/[0.08]">{store.name}</p>
      </div>
      <footer className="border-t border-st-border text-sm">
        <div className="store-page grid-12 gap-y-10 py-12 sm:py-16">
          {about && (
            <section className="col-span-4 max-w-prose md:col-span-5">
              <h2 className={colHead}>{t("about")}</h2>
              <p className="whitespace-pre-line leading-relaxed">{about}</p>
            </section>
          )}
          {returns && (
            <section id="returns" className="col-span-4 max-w-prose scroll-mt-24 md:col-span-4">
              <h2 className={colHead}>{t("returnPolicy")}</h2>
              <p className="whitespace-pre-line leading-relaxed">{returns}</p>
            </section>
          )}
          {(wa || store.instagram) && (
            <section className="col-span-4 md:col-span-3">
              <h2 className={colHead}>{t("contact")}</h2>
              <ul className="-mt-3 grid">
                {wa && (
                  <li>
                    <a href={waLink(wa, t("waStoreIntro", { store: store.name }))} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                      {t("chatWhatsApp")}
                    </a>
                  </li>
                )}
                {store.instagram && (
                  <li>
                    <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" dir="ltr">
                      @{store.instagram}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
        <div className="store-page flex flex-wrap items-center justify-between gap-3 border-t border-st-border py-4">
          <LocaleSwitcher current={locale} locales={["ku", "ar", "en", "kmr"]} />
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-muted hover:text-st-fg">
            <Awning className="h-3 w-7" /> {t("poweredBy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
