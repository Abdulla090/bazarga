import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { getCatalog, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { ProductCard } from "@/components/store/ProductCard";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { filterCatalog, DEFAULT_PAGE_SIZE } from "@/lib/catalog-filter";
import { waLink } from "@/lib/whatsapp";
import { buildSrcSet, SIZES } from "@/lib/responsive-image";
import { normalizePhone } from "@/lib/phone";
import { Icon, MessageCircle, Search, Truck, X } from "@/components/ui/icons";
import { ViewPixel } from "@/components/store/ViewPixel";

type SP = { c?: string | string[]; q?: string | string[]; page?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Build a store-home href keeping only the params that are set. */
function homeHref(slug: string, p: { q?: string; c?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.c) sp.set("c", p.c);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return `/s/${slug}${s ? `?${s}` : ""}`;
}

const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold transition-colors";
const chipOn = "bg-st-accent text-st-on-accent";
const chipOff = "border border-st-border bg-st-surface text-st-fg";

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const c = one(sp.c);
  const store = await loadStore(slug);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const [{ products, categories: usedCats }, { zones }] = await Promise.all([getCatalog(store.id), getStorefrontSettings(store.id)]);
  const { items, total, hasMore, page } = filterCatalog(products, { q, c, page: one(sp.page), locale, pageSize: DEFAULT_PAGE_SIZE });
  const cardLabels = {
    add: t("addToCart"),
    added: t("added"),
    soldOut: t("outOfStock"),
    chooseOptions: t("chooseOptions"),
    from: t.raw("from") as string,
    onlyLeft: t.raw("onlyLeft") as string,
  };
  const minFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : null;
  const tagline = pickText(store.tagline, locale);
  const about = pickText(store.about, locale);
  const wa = store.whatsapp ? normalizePhone(store.whatsapp) : null;
  const remaining = Math.min(total - items.length, DEFAULT_PAGE_SIZE);

  return (
    <div className="grid gap-5">
      <ViewPixel slug={store.slug} />
      {/* Hero: cover photo (LCP, eager) with a scrim, or the theme's hero colour as a gradient. */}
      <section className="relative -mt-2 overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-st-hero to-st-hero/80 text-st-on-hero">
        {store.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.coverImageUrl}
            srcSet={buildSrcSet(store.coverImageRenditions)}
            sizes={store.coverImageRenditions?.length ? SIZES.cover : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={store.coverImagePlaceholder ? { backgroundImage: `url("${store.coverImagePlaceholder}")`, backgroundSize: "cover" } : undefined}
          />
        )}
        {store.coverImageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden />}
        <div className={`relative flex min-h-40 flex-col justify-end gap-2 p-4 sm:min-h-56 sm:p-6 ${store.coverImageUrl ? "text-white" : ""}`}>
          <div className="flex items-center gap-3">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full border-2 border-white/80 bg-st-surface object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-st-accent text-2xl font-extrabold text-st-on-accent">{store.name.slice(0, 1)}</span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold leading-tight">{store.name}</h1>
              {tagline && <p className="line-clamp-2 text-sm opacity-90">{tagline}</p>}
            </div>
          </div>
          {about && <p className="line-clamp-3 max-w-prose text-sm opacity-90">{about}</p>}
        </div>
      </section>

      {minFee !== null && (
        <p className="flex items-center gap-2 rounded-xl border border-st-border bg-st-surface px-3 py-2 text-sm font-semibold text-st-fg">
          <Icon as={Truck} className="shrink-0 text-st-accent" />
          <span>
            {minFee === 0 ? t("freeDelivery") : t("deliveryFrom", { fee: formatIQD(minFee, locale) })}
            {store.freeDeliveryThreshold ? ` · ${t("freeDeliveryOver", { amount: formatIQD(store.freeDeliveryThreshold, locale) })}` : null}
          </span>
        </p>
      )}

      {/* Plain GET form: works without JS, keeps the category. */}
      <form action={`/s/${slug}`} method="get" role="search" className="flex items-center gap-2">
        {c && <input type="hidden" name="c" value={c} />}
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Icon as={Search} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-st-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            enterKeyHint="search"
            maxLength={80}
            className="h-11 w-full rounded-xl border border-st-border bg-st-surface ps-10 pe-3 text-base text-st-fg placeholder:text-st-muted focus:outline-2 focus:outline-st-accent"
          />
        </label>
        <button type="submit" className="h-11 shrink-0 rounded-xl bg-st-accent px-4 font-bold text-st-on-accent">{t("search")}</button>
      </form>

      {usedCats.length > 0 && (
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label={t("products")}>
          <Link href={homeHref(slug, { q })} aria-current={!c ? "page" : undefined} className={`${chip} ${!c ? chipOn : chipOff}`}>{t("all")}</Link>
          {usedCats.map((cat) => (
            <Link key={cat.id} href={homeHref(slug, { q, c: cat.id })} aria-current={c === cat.id ? "page" : undefined} className={`${chip} ${c === cat.id ? chipOn : chipOff}`}>
              {pickText(cat.name, locale)}
            </Link>
          ))}
        </nav>
      )}

      {q && (
        <p className="flex items-center justify-between gap-2 text-sm text-st-muted" aria-live="polite">
          <span>{t("resultsFor", { q, count: total })}</span>
          <Link href={homeHref(slug, { c })} className="inline-flex items-center gap-1 font-semibold text-st-fg underline">
            <Icon as={X} /> {t("clearSearch")}
          </Link>
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-st-border bg-st-surface p-6 text-center text-st-muted">{q ? t("noResults", { q }) : t("noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <div key={p.id} id={`p${i}`} className="scroll-mt-24">
              <ProductCard p={p} slug={store.slug} locale={locale} index={i} labels={cardLabels} />
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <Link
          href={`${homeHref(slug, { q, c, page: page + 1 })}#p${items.length}`}
          scroll={false}
          className="mx-auto rounded-xl border border-st-border bg-st-surface px-5 py-3 font-bold text-st-fg"
        >
          {t("showMore", { count: remaining })}
        </Link>
      )}

      {wa && (
        <a
          href={waLink(wa, t("waStoreIntro", { store: store.name }))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("chatWhatsApp")}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] start-[calc(1rem+env(safe-area-inset-left))] z-30 flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-4 font-bold text-white shadow-lg rtl:start-[calc(1rem+env(safe-area-inset-right))]"
        >
          <Icon as={MessageCircle} className="h-6 w-6" />
          <span className="hidden sm:inline">{t("chatWhatsApp")}</span>
        </a>
      )}
    </div>
  );
}
