import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { getCatalog, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { ProductCard } from "@/components/store/ProductCard";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { Icon, Truck } from "@/components/ui/icons";

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const store = await loadStore(slug);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const [{ products, categories: usedCats }, { zones }] = await Promise.all([getCatalog(store.id), getStorefrontSettings(store.id)]);
  const shown = c ? products.filter((p) => p.categoryId === c) : products;
  const cardLabels = {
    add: t("addToCart"),
    added: t("added"),
    soldOut: t("outOfStock"),
    chooseOptions: t("chooseOptions"),
    from: t.raw("from") as string,
    onlyLeft: t.raw("onlyLeft") as string,
  };
  const minFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : null;

  return (
    <div className="grid gap-5">
      {store.coverImageUrl && (
        // Cover is the LCP element on the store home: eager + high priority, placeholder behind it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.coverImageUrl}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="-mt-2 aspect-[16/6] w-full rounded-[var(--radius-card)] bg-st-hero object-cover"
          style={store.coverImagePlaceholder ? { backgroundImage: `url("${store.coverImagePlaceholder}")`, backgroundSize: "cover" } : undefined}
        />
      )}
      {minFee !== null && (
        <p className="flex items-center gap-2 rounded-xl border border-st-border bg-st-surface px-3 py-2 text-sm font-semibold text-st-fg">
          <Icon as={Truck} className="text-st-accent" /> {minFee === 0 ? t("freeDelivery") : t("deliveryFrom", { fee: formatIQD(minFee, locale) })}
        </p>
      )}
      {usedCats.length > 0 && (
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          <Link href={`/s/${slug}`} aria-current={!c ? "page" : undefined} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${!c ? "bg-ink text-paper" : "border border-line bg-white"}`}>{t("all")}</Link>
          {usedCats.map((cat) => (
            <Link key={cat.id} href={`/s/${slug}?c=${cat.id}`} aria-current={c === cat.id ? "page" : undefined} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${c === cat.id ? "bg-ink text-paper" : "border border-line bg-white"}`}>
              {pickText(cat.name, locale)}
            </Link>
          ))}
        </nav>
      )}
      {shown.length === 0 ? (
        <p className="card text-center text-ink-70">{t("noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p, i) => (
            <ProductCard key={p.id} p={p} slug={store.slug} locale={locale} index={i} labels={cardLabels} />
          ))}
        </div>
      )}
    </div>
  );
}
