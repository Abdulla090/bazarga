import { EmptyState } from "@/components/dashboard/EmptyState";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listProducts } from "@/server/services/catalog";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { pickText } from "@/lib/i18n";
import { ActiveToggle } from "./ActiveToggle";
import { Icon, Sparkles } from "@/components/ui/icons";

export default async function ProductsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("products");
  const td = await getTranslations("dash");
  const locale = await currentLocale();
  const products = await listProducts(db(), store.id);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline me-auto">{t("title")}</h1>
        <Link href="/dashboard/ai" className="btn-ghost btn-sm"><Icon as={Sparkles} /> {td("ai")}</Link>
        <Link href="/dashboard/products/new" className="btn-gold btn-sm">+ {t("new")}</Link>
      </div>
      {products.length === 0 ? (
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
              </Link>
              <ActiveToggle id={p.id} active={p.isActive} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
