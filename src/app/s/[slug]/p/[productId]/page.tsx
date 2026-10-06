import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { loadStore } from "../../data";
import { db } from "@/server/db";
import { getProduct } from "@/server/services/catalog";
import { currentLocale } from "@/server/locale";
import { AddToCart } from "@/components/store/AddToCart";
import { formatIQD } from "@/lib/money";
import { pickText } from "@/lib/i18n";

async function load(slug: string, productId: string) {
  if (!z.uuid().safeParse(productId).success) notFound();
  const store = await loadStore(slug);
  const p = await getProduct(db(), store.id, productId);
  if (!p || !p.isActive) notFound();
  return { store, p };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const { store, p } = await load(slug, productId);
  const locale = await currentLocale();
  return {
    title: { absolute: `${pickText(p.name, locale)} · ${store.name}` },
    description: pickText(p.description, locale).slice(0, 160),
    openGraph: { images: p.images[0] ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const { store, p } = await load(slug, productId);
  const t = await getTranslations("store");
  const tc = await getTranslations("common");
  const locale = await currentLocale();
  const name = pickText(p.name, locale);
  const soldOut = p.stock !== null && p.stock <= 0;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid gap-2">
        {p.images.length ? (
          p.images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.url} alt={i === 0 ? name : ""} className="w-full rounded-[var(--radius-card)] border border-line object-cover" />
          ))
        ) : (
          <span className="block aspect-square rounded-[var(--radius-card)] bg-white" />
        )}
      </div>
      <div className="grid h-fit gap-4 md:sticky md:top-24">
        <Link href={`/s/${store.slug}`} className="text-sm font-semibold text-ink-70">← {tc("back")}</Link>
        <h1 className="text-3xl font-extrabold">{name}</h1>
        <p className="num text-2xl">
          <span className="font-extrabold">{formatIQD(p.price, locale)}</span>
          {p.compareAtPrice && p.compareAtPrice > p.price && <s className="ms-3 text-lg text-ink-50">{formatIQD(p.compareAtPrice, locale)}</s>}
        </p>
        {p.stock !== null && p.stock > 0 && p.stock <= 5 && <p className="font-semibold text-danger">{t("onlyLeft", { count: p.stock })}</p>}
        <AddToCart slug={store.slug} productId={p.id} disabled={soldOut} big />
        {pickText(p.description, locale) && <p className="whitespace-pre-line leading-relaxed text-ink-70">{pickText(p.description, locale)}</p>}
        <Link href={`/s/${store.slug}/cart`} className="btn-ghost">{t("checkout")} →</Link>
      </div>
    </div>
  );
}
