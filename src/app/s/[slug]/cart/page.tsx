import type { Metadata } from "next";
import { loadStore } from "../data";
import { getStorefrontSettings } from "@/server/cache/storefront";
import { isProviderAvailable } from "@/server/payments/registry";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { getMessages, getTranslations } from "next-intl/server";
import { CartCheckout } from "@/components/store/CartCheckout";
import { CART_LABEL_KEYS } from "@/components/store/cart-labels";
import { pickLabels } from "@/lib/fmt";

export const metadata: Metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  const locale = await currentLocale();
  const { zones, payments: enabled } = await getStorefrontSettings(store.id);
  const payments = enabled.filter((m) => m === "cod" || isProviderAvailable(m));
  const [t, tp, messages] = await Promise.all([getTranslations("store"), getTranslations("payments"), getMessages()]);
  const labels = { ...pickLabels((k) => t.raw(k), CART_LABEL_KEYS), cod: tp("cod"), errors: messages.errors as Record<string, string> };
  return (
    <CartCheckout
      labels={labels}
      slug={store.slug}
      locale={locale}
      zones={zones.map((z) => ({ key: z.key, name: pickText(z.name, locale), fee: z.fee, areas: z.areas.map((a) => ({ id: a.id, name: pickText(a.name, locale), fee: a.fee })) }))}
      payments={payments}
      defaultCity={store.city ?? zones[0]?.key ?? ""}
    />
  );
}
