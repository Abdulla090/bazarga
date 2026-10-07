import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { listCategories } from "@/server/services/catalog";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { ProductForm } from "@/components/dashboard/ProductForm";

export default async function NewProductPage() {
  const { store } = await requireStore();
  const t = await getTranslations("products");
  const locale = await currentLocale();
  const cats = await listCategories(db(), store.id);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">{t("new")}</h1>
      <ProductForm
        defaultLang={store.defaultLocale}
        maxMb={env().MAX_UPLOAD_MB}
        categories={cats.map((c) => ({ id: c.id, name: pickText(c.name, locale) }))}
        initial={{ name: {}, description: {}, price: "", compareAtPrice: null, stock: null, sku: null, specs: [], categoryId: null, isActive: true, images: [] }}
      />
    </div>
  );
}
