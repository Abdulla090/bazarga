import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getProductUsage, listCategories } from "@/server/services/catalog";
import Link from "next/link";
import { PlanUsage } from "@/components/dashboard/PlanUsage";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { ProductForm } from "@/components/dashboard/ProductForm";

export default async function NewProductPage() {
  const { store } = await requireStore();
  const t = await getTranslations("products");
  const locale = await currentLocale();
  const tp = await getTranslations("pricing");
  const [cats, usage] = await Promise.all([listCategories(db(), store.id), getProductUsage(db(), store.id)]);
  const atLimit = usage.used >= usage.cap;
  return (
    <div className="grid gap-8">
      <h1 className="t-headline">{t("new")}</h1>
      {atLimit ? (
        <div className="grid max-w-xl gap-4 rounded-2xl border border-line bg-white p-6" data-testid="limit-reached" role="status">
          <p className="font-medium">{tp("limitHint")}</p>
          <Link href="/dashboard/upgrade" data-testid="limit-upgrade" className="btn-gold inline-flex min-h-11 w-fit items-center">{tp("upgradeCta")}</Link>
        </div>
      ) : (
      <>
      {usage.shown !== null && usage.used >= Math.ceil(usage.shown * 0.8) && (
        <PlanUsage label={tp("usageProducts", { used: String(usage.used), limit: String(usage.shown) })} used={usage.used} shown={usage.shown} plan={tp(usage.plan)} hint={null} cta={tp("upgradeCta")} />
      )}
      <ProductForm
        defaultLang={store.defaultLocale}
        maxMb={env().MAX_UPLOAD_MB}
        categories={cats.map((c) => ({ id: c.id, name: pickText(c.name, locale) }))}
        initial={{ name: {}, description: {}, price: "", compareAtPrice: null, stock: null, sku: null, specs: [], categoryId: null, isActive: true, images: [] }}
      />
      </>
      )}
    </div>
  );
}
