import Link from "next/link";
import { normalizePlan, showsBazargaBadge } from "@/lib/plans";
import { getTranslations } from "next-intl/server";
import { CartLink } from "@/components/store/CartLink";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Awning } from "@/components/Logo";
import { Icon, Search } from "@/components/ui/icons";
import { waLink } from "@/lib/whatsapp";
import type { Locale } from "@/lib/i18n";
import type { DesignSpec } from "@/lib/theme-studio/designs";

type ChromeStore = { slug: string; name: string; logoUrl: string | null; instagram: string | null; plan?: string | null };

function Mark({ store, size = "h-7 w-7" }: { store: ChromeStore; size?: string }) {
  return store.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={store.logoUrl} alt="" className={`store-mark ${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`store-mark flex ${size} shrink-0 items-center justify-center rounded-full bg-st-fg text-xs font-medium text-st-bg`}>{store.name.slice(0, 1)}</span>
  );
}

/**
 * Store header per design. classic/editorial: logo + name, search jump, cart (editorial's masthead is the centered
 * grid in globals.css, set in display type). market: logo, a wide always-visible search field from md, cart.
 */
export async function StoreHeader({ store, design }: { store: ChromeStore; design: DesignSpec }) {
  const t = await getTranslations("store");
  const searchLink = (
    <Link href={`/s/${store.slug}#products`} aria-label={t("search")} className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-st-fg/5" data-testid="header-search">
      <Icon as={Search} className="h-[22px] w-[22px]" />
    </Link>
  );
  if (design.id === "market") {
    return (
      <header className="store-header sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="store-page flex h-16 items-center gap-3 md:gap-8">
          <Link href={`/s/${store.slug}`} className="me-auto flex min-h-11 min-w-0 items-center gap-2.5 md:me-0">
            <Mark store={store} size="h-8 w-8" />
            <span className="store-name truncate">{store.name}</span>
          </Link>
          <form action={`/s/${store.slug}#products`} method="get" role="search" className="hidden max-w-2xl flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">{t("search")}</span>
              <Icon as={Search} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" name="q" maxLength={80} placeholder={t("searchPlaceholder")} enterKeyHint="search" data-testid="header-search-field" className="h-11 w-full rounded-lg border border-st-border bg-st-surface ps-11 pe-4 text-[15px] text-st-fg placeholder:text-faint hover:border-st-fg/40 focus:border-st-fg focus:outline-none" />
            </label>
          </form>
          <span className="md:hidden">{searchLink}</span>
          <CartLink slug={store.slug} label={t("cart")} />
        </div>
      </header>
    );
  }
  return (
    <header className="store-header sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="store-page flex h-16 items-center gap-3">
        <Link href={`/s/${store.slug}`} className="me-auto flex min-h-11 min-w-0 items-center gap-2.5">
          <Mark store={store} />
          <span className="store-name truncate text-[15px] font-medium">{store.name}</span>
        </Link>
        {/* Search lives with the catalog; the header icon jumps there from anywhere (Fitts: always one tap away). */}
        {searchLink}
        <CartLink slug={store.slug} label={t("cart")} />
      </div>
    </header>
  );
}

export async function StoreFooter({
  store,
  design,
  locale,
  about,
  returns,
  wa,
}: {
  store: ChromeStore;
  design: DesignSpec;
  locale: Locale;
  about: string;
  returns: string;
  wa: string | null;
}) {
  const t = await getTranslations("store");
  const colHead = "t-label mb-3 text-muted";
  const link = "inline-flex min-h-11 items-center underline-offset-4 hover:underline";
  const contact =
    wa || store.instagram ? (
      <section className={design.footer === "classic" ? "col-span-4 md:col-span-3" : ""}>
        <h2 className={colHead}>{t("contact")}</h2>
        <ul className="-mt-3 grid">
          {wa && (
            <li>
              <a href={waLink(wa, t("waStoreIntro", { store: store.name }))} target="_blank" rel="noopener noreferrer" className={link}>
                {t("chatWhatsApp")}
              </a>
            </li>
          )}
          {store.instagram && (
            <li>
              <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noopener noreferrer" className={link} dir="ltr">
                @{store.instagram}
              </a>
            </li>
          )}
        </ul>
      </section>
    ) : null;
  const bar = (
    <div className="store-page flex flex-wrap items-center justify-between gap-3 border-t border-st-border py-4">
      <LocaleSwitcher current={locale} locales={["ku", "ar", "en", "kmr"]} />
      {/* "Made with Bazarga" shows on Free only (src/lib/plans.ts showsBazargaBadge); Pro and up remove it. */}
      {showsBazargaBadge(normalizePlan(store.plan)) && (
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-muted hover:text-st-fg" data-bazarga-badge>
          <Awning className="h-3 w-7" /> {t("poweredBy")}
        </Link>
      )}
    </div>
  );

  if (design.footer === "editorial") {
    return (
      <footer className="store-footer border-t border-st-border text-sm" data-footer="editorial">
        <div className="store-page grid justify-items-center gap-12 py-16 text-center sm:py-24">
          {about && <p className="sf-display max-w-3xl whitespace-pre-line text-balance text-2xl leading-snug sm:text-4xl">{about}</p>}
          <div className="grid w-full max-w-3xl gap-10 border-t border-st-border pt-10 sm:grid-cols-2 sm:text-start">
            {returns && (
              <section id="returns" className="scroll-mt-24">
                <h2 className={colHead}>{t("returnPolicy")}</h2>
                <p className="whitespace-pre-line leading-relaxed">{returns}</p>
              </section>
            )}
            {contact}
          </div>
        </div>
        {bar}
      </footer>
    );
  }

  if (design.footer === "soft") {
    return (
      <footer className="store-footer mt-20 rounded-t-[2rem] bg-st-surface text-sm" data-footer="soft">
        <div className="store-page grid justify-items-center gap-8 py-14 text-center">
          <p className="store-name text-2xl">{store.name}</p>
          {about && <p className="line-clamp-4 max-w-xl whitespace-pre-line leading-relaxed text-muted">{about}</p>}
          <div className="grid w-full max-w-3xl gap-8 sm:grid-cols-2 sm:text-start">
            {returns && (
              <section id="returns" className="scroll-mt-24">
                <h2 className={colHead}>{t("returnPolicy")}</h2>
                <p className="line-clamp-6 whitespace-pre-line leading-relaxed">{returns}</p>
              </section>
            )}
            {contact}
          </div>
        </div>
        {bar}
      </footer>
    );
  }

  if (design.footer === "ledger") {
    return (
      <footer className="store-footer mt-20 text-sm" data-footer="ledger">
        <div className="store-page grid gap-8 py-10 md:grid-cols-3 md:gap-12">
          <section className="grid content-start gap-3">
            <p className="store-name text-lg">{store.name}</p>
            {about && <p className="line-clamp-4 whitespace-pre-line leading-relaxed">{about}</p>}
          </section>
          {returns && (
            <section id="returns" className="scroll-mt-24 border-t-2 border-st-fg pt-3 md:border-t-0 md:pt-0">
              <h2 className="mono-label mb-2">{t("returnPolicy")}</h2>
              <p className="line-clamp-6 whitespace-pre-line leading-relaxed">{returns}</p>
            </section>
          )}
          <div className="border-t-2 border-st-fg pt-3 md:border-t-0 md:pt-0">{contact}</div>
        </div>
        {bar}
      </footer>
    );
  }

  if (design.footer === "minimal") {
    return (
      <footer className="store-footer mt-16 border-t border-st-border text-sm" data-footer="minimal">
        <div className="store-page grid justify-items-center gap-8 py-12 text-center">
          <p className="store-name text-lg uppercase tracking-[0.18em]">{store.name}</p>
          {about && <p className="line-clamp-4 max-w-xl whitespace-pre-line leading-relaxed text-muted">{about}</p>}
          <div className="grid w-full max-w-3xl gap-8 sm:grid-cols-2 sm:text-start">
            {returns && (
              <section id="returns" className="scroll-mt-24">
                <h2 className={colHead}>{t("returnPolicy")}</h2>
                <p className="line-clamp-6 whitespace-pre-line leading-relaxed">{returns}</p>
              </section>
            )}
            {contact}
          </div>
        </div>
        {bar}
      </footer>
    );
  }

  if (design.footer === "dense") {
    return (
      <footer className="store-footer mt-16 border-t border-st-border bg-st-surface text-sm" data-footer="dense">
        <div className="store-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4">
          <section className="col-span-2 grid content-start gap-3 md:col-span-2">
            <p className="store-name text-base">{store.name}</p>
            {about && <p className="line-clamp-4 max-w-md whitespace-pre-line leading-relaxed text-muted">{about}</p>}
          </section>
          {returns && (
            <section id="returns" className="scroll-mt-24">
              <h2 className={colHead}>{t("returnPolicy")}</h2>
              <p className="line-clamp-6 whitespace-pre-line leading-relaxed">{returns}</p>
            </section>
          )}
          {contact}
        </div>
        {bar}
      </footer>
    );
  }

  return (
    <>
      {/* Sign-off: the store name set very large and faint as a closing statement (Layout v3 §8). */}
      <div className="store-page section pb-6 sm:pb-8" aria-hidden data-testid="sign-off">
        <p aria-hidden="true" data-text={store.name} className="t-hero select-none break-words text-st-fg/[0.08] before:content-[attr(data-text)]" />
      </div>
      <footer className="store-footer border-t border-st-border text-sm" data-footer="classic">
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
          {contact}
        </div>
        {bar}
      </footer>
    </>
  );
}
