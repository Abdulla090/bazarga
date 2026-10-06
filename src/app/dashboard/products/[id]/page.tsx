import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getProduct, listCategories } from "@/server/services/catalog";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { ProductForm } from "@/components/dashboard/ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { store } = await requireStore();
  const product = await getProduct(db(), store.id, id);
  if (!product) notFound();
  const t = await getTranslations("products");
  const locale = await currentLocale();
  const cats = await listCategories(db(), store.id);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">{t("edit")}</h1>
      <ProductForm
        defaultLang={store.defaultLocale}
        maxMb={env().MAX_UPLOAD_MB}
        categories={cats.map((c) => ({ id: c.id, name: pickText(c.name, locale) }))}
        initial={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          stock: product.stock,
          categoryId: product.categoryId,
          isActive: product.isActive,
          images: product.images.map((i) => i.url),
        }}
      />
    </div>
  );
}
