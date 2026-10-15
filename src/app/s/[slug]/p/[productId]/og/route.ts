import { notFound } from "next/navigation";
import { z } from "zod";
import { loadStore } from "../../../data";
import { getProductDetail } from "@/server/cache/storefront";
import { loadStoreImage } from "@/server/share/assets";
import { renderProductCardPng } from "@/server/share/product-card";
import { storyLocale } from "@/lib/share-kit";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { resolveTheme } from "@/lib/theme";

/** Per-product link-preview image (1200×630 PNG). GET ?lang=ku|ar|en|kmr (default: the store's language). Public, cacheable. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  if (!z.uuid().safeParse(productId).success) notFound();
  const store = await loadStore(slug);
  const p = await getProductDetail(store.id, productId);
  if (!p) notFound();
  const locale = storyLocale(new URL(req.url).searchParams.get("lang"), store.defaultLocale);
  const cover = p.images[0];
  const png = await renderProductCardPng({
    name: pickText(p.name, locale),
    price: formatIQD(p.price, locale),
    compareAt: p.compareAtPrice && p.compareAtPrice > p.price ? formatIQD(p.compareAtPrice, locale) : null,
    store: store.name,
    image: cover ? await loadStoreImage(cover.url, store.id) : null,
    theme: resolveTheme(store.themePreset, store.accentColor),
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300, s-maxage=3600", "X-Content-Type-Options": "nosniff" },
  });
}
