import type { Metadata } from "next";
import { loadStore } from "../data";
import { db } from "@/server/db";
import { listPaymentMethods, listZones } from "@/server/services/settings";
import { isProviderAvailable } from "@/server/payments/registry";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { CartCheckout } from "@/components/store/CartCheckout";

export const metadata: Metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  const locale = await currentLocale();
  const [zones, methods] = await Promise.all([listZones(db(), store.id, { activeOnly: true }), listPaymentMethods(db(), store.id)]);
  const payments = methods.filter((m) => m.enabled && (m.method === "cod" || isProviderAvailable(m.method))).map((m) => m.method);
  return (
    <CartCheckout
      slug={store.slug}
      locale={locale}
      zones={zones.map((z) => ({ key: z.cityKey, name: pickText(z.name, locale), fee: z.fee }))}
      payments={payments}
      defaultCity={store.city ?? zones[0]?.cityKey ?? ""}
    />
  );
}
