import { EmptyState } from "@/components/dashboard/EmptyState";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { getProductUsage, listProducts } from "@/server/services/catalog";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { pickText } from "@/lib/i18n";
import { stockLevel } from "@/lib/low-stock";
import { ActiveToggle } from "./ActiveToggle";
import { BulkVisibility } from "./BulkVisibility";
import { ProductShareButton } from "@/components/dashboard/ProductShareButton";
import { CAPTION_LOCALES, type CaptionLocale } from "@/lib/social";
import { Icon, Sparkles } from "@/components/ui/icons";
import { PlanUsage } from "@/components/dashboard/PlanUsage";
import { ListPager, ListSearch } from "@/components/dashboard/ListControls";
import { DASH_PAGE_SIZE, matchesProduct, pageWindow, parseDashPage, parseDashQuery } from "@/lib/dash-list";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("products");
  const td = await getTranslations("dash");
  const locale = await currentLocale();
  const tp = await getTranslations("pricing");
  const [all, usage] = await Promise.all([listProducts(db(), store.id), getProductUsage(db(), store.id)]);
  const sp = await searchParams;
  const q = parseDashQuery(sp.q);
  const matched = q ? all.filter((p) => matchesProduct(p, q)) : all;
  const win = pageWindow(parseDashPage(sp.page), matched.length);
  const products = matched.slice(win.offset, win.offset + DASH_PAGE_SIZE);
  const labels = { search: td("search"), placeholder: td("searchProducts"), clear: td("clearSearch"), newer: td("prevPage"), older: td("nextPage"), showing: td("showing", { from: String(win.from), to: String(win.to), total: String(matched.length) }) };
  const atLimit = usage.used >= usage.cap;
  const asCaption = (l: string): CaptionLocale | null => ((CAPTION_LOCALES as readonly string[]).includes(l) ? (l as CaptionLocale) : null);
  const shareLocale: CaptionLocale = asCaption(locale) ?? asCaption(store.defaultLocale) ?? "ku";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline me-auto">{t("title")}</h1>
        {all.length > 0 && (
          <a href="/api/products/export" download className="btn-ghost btn-sm" data-testid="products-export">{t("export")}</a>
        )}
        <Link href="/dashboard/products/import" className="btn-ghost btn-sm" data-testid="products-import-link">{t("importCta")}</Link>
        <Link href="/dashboard/ai" className="btn-ghost btn-sm"><Icon as={Sparkles} /> {td("ai")}</Link>
        <Link href="/dashboard/products/new" className="btn-gold btn-sm">+ {t("new")}</Link>
      </div>
      <PlanUsage
        label={usage.shown === null ? tp("usageProductsUnlimited", { used: String(usage.used) }) : tp("usageProducts", { used: String(usage.used), limit: String(usage.shown) })}
        used={usage.used}
        shown={usage.shown}
        plan={tp(usage.plan)}
        hint={atLimit ? tp("limitHint") : null}
        cta={usage.plan === "max" ? null : tp("upgradeCta")}
      />
      {products.length > 1 && <BulkVisibility ids={products.map((p) => p.id)} />}
      {all.length > 0 && <ListSearch base="/dashboard/products" q={q} labels={labels} testId="products-search" />}
      {all.length > 0 && products.length === 0 ? (
        <p className="rounded-xl border border-line p-6 text-center text-ink-70" data-testid="products-no-match">{td("noMatches", { q })}</p>
      ) : products.length === 0 ? (
        <EmptyState title={t("empty")} help={t("emptyHelp")} href="/dashboard/products/new" cta={t("emptyCta")} testId="products-empty" />
      ) : (
        <ul className="divide-y divide-line border-y border-line lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-x-12">
          {products.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center gap-4 border-line py-4 lg:border-b">
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0].renditions[0]?.url ?? p.images[0].url} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="h-16 w-16 shrink-0 rounded-lg bg-ink/5" />
              )}
              <Link href={`/dashboard/products/${p.id}`} className="min-w-0 flex-1 py-1">
                <span className="block truncate font-medium">{pickText(p.name, locale)}</span>
                <span className="num block truncate text-sm text-ink-70">
                  {formatIQD(p.price, locale)} · {p.stock === null ? t("untracked") : t("inStock", { count: p.stock })}
                </span>
                {(stockLevel(p.stock) === "low" || stockLevel(p.stock) === "out") && (
                  <span className={stockLevel(p.stock) === "out" ? "badge badge-danger mt-1 py-1" : "badge mt-1 py-1"} data-testid="stock-badge">
                    {stockLevel(p.stock) === "out" ? td("soldOut") : td("lowStockLeft", { count: p.stock ?? 0 })}
                  </span>
                )}
              </Link>
              <ProductShareButton productId={p.id} slug={store.slug} storeName={store.name} names={p.name} price={p.price} defaultLocale={shareLocale} />
              <ActiveToggle id={p.id} active={p.isActive} />
            </li>
          ))}
        </ul>
      )}
      {matched.length > 0 && <ListPager base="/dashboard/products" page={win.page} pages={win.pages} q={q} labels={labels} testId="products-pager" />}
    </div>
  );
}
