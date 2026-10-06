import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { db } from "@/server/db";
import { listCategories, listProducts } from "@/server/services/catalog";
import { listZones } from "@/server/services/settings";
import { currentLocale } from "@/server/locale";
import { ProductCard } from "@/components/store/ProductCard";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const store = await loadStore(slug);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const [products, categories, zones] = await Promise.all([
    listProducts(db(), store.id, { activeOnly: true }),
    listCategories(db(), store.id),
    listZones(db(), store.id, { activeOnly: true }),
  ]);
  const usedCats = categories.filter((cat) => products.some((p) => p.categoryId === cat.id));
  const shown = c ? products.filter((p) => p.categoryId === c) : products;
  const minFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : null;

  return (
    <div className="grid gap-5">
      {minFee !== null && (
        <p className="rounded-xl bg-green/10 px-3 py-2 text-sm font-semibold text-green">
          🚚 {minFee === 0 ? t("freeDelivery") : t("deliveryFrom", { fee: formatIQD(minFee, locale) })}
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
          {shown.map((p) => (
            <ProductCard key={p.id} p={p} slug={store.slug} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
