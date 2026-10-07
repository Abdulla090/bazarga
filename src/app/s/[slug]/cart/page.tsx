import type { Metadata } from "next";
import { loadStore } from "../data";
import { getStorefrontSettings } from "@/server/cache/storefront";
import { isProviderAvailable } from "@/server/payments/registry";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { CartCheckout } from "@/components/store/CartCheckout";

export const metadata: Metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  const locale = await currentLocale();
  const { zones, payments: enabled } = await getStorefrontSettings(store.id);
  const payments = enabled.filter((m) => m === "cod" || isProviderAvailable(m));
  return (
    <CartCheckout
      slug={store.slug}
      locale={locale}
      zones={zones.map((z) => ({ key: z.key, name: pickText(z.name, locale), fee: z.fee }))}
      payments={payments}
      defaultCity={store.city ?? zones[0]?.key ?? ""}
    />
  );
}
