import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getProduct, getProductVariants, listCategories } from "@/server/services/catalog";
import { editorFromDb } from "@/lib/variant-editor";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { ProductSeoForm } from "@/components/dashboard/SeoForms";
import { hasFeature, normalizePlan } from "@/lib/plans";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { store } = await requireStore();
  const product = await getProduct(db(), store.id, id);
  if (!product) notFound();
  const t = await getTranslations("products");
  const locale = await currentLocale();
  const [cats, vd] = await Promise.all([listCategories(db(), store.id), getProductVariants(db(), store.id, product.id)]);
  return (
    <div className="grid gap-8">
      <h1 className="t-headline">{t("edit")}</h1>
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
          sku: product.sku,
          specs: product.specs,
          categoryId: product.categoryId,
          badge: product.badge ?? null,
          isActive: product.isActive,
          variants: editorFromDb(vd.options, vd.values, vd.variants),
          images: product.images.map((i) => ({
            url: i.url,
            width: i.width,
            height: i.height,
            placeholder: i.placeholder,
            dominantColor: i.dominantColor,
            renditions: i.renditions,
          })),
        }}
      />
      {hasFeature(normalizePlan(store.plan), "seoAdvanced") && (
        <ProductSeoForm
          productId={product.id}
          placeholderTitle={`${pickText(product.name, store.defaultLocale)} · ${store.name}`}
          initial={{ title: product.seo?.title ?? "", description: product.seo?.description ?? "" }}
        />
      )}
    </div>
  );
}
