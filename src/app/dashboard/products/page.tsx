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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-2xl font-extrabold">{t("title")}</h1>
        <Link href="/dashboard/ai" className="btn-ghost btn-sm"><Icon as={Sparkles} /> {td("ai")}</Link>
        <Link href="/dashboard/products/new" className="btn-gold btn-sm">+ {t("new")}</Link>
      </div>
      {products.length === 0 ? (
        <p className="card text-ink-70">{t("empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {products.map((p) => (
            <li key={p.id} className="card flex items-center gap-3 p-3">
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0].renditions[0]?.url ?? p.images[0].url} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="h-16 w-16 shrink-0 rounded-xl bg-paper" />
              )}
              <Link href={`/dashboard/products/${p.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-bold">{pickText(p.name, locale)}</span>
                <span className="num block text-sm text-ink-70">
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
