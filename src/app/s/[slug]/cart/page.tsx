import type { Metadata } from "next";
import { loadStore } from "../data";
import { getStorefrontSettings } from "@/server/cache/storefront";
import { isProviderAvailable } from "@/server/payments/registry";
import { db } from "@/server/db";
import { storeOnlineStatus } from "@/server/payments/gateway/service";
import { gatewayChips } from "@/server/payments/gateway/chips";
import { gateway } from "@/server/payments/gateway/registry";
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
  // Platform gateway: only when PAYMENTS_PROVIDER is on, payouts are verified and the seller turned it on. COD stays first.
  const onlineOn = gateway() ? (await storeOnlineStatus(db(), store.id)).available : false;
  if (onlineOn && !payments.includes("online")) payments.push("online");
  const [t, tp, tg, messages] = await Promise.all([getTranslations("store"), getTranslations("payments"), getTranslations("gatewayPay"), getMessages()]);
  const online = onlineOn ? { label: tg("cartOnline"), hint: tg("cartOnlineHint"), soonLabel: tg("soon"), chips: gatewayChips() } : null;
  const labels = { ...pickLabels((k) => t.raw(k), CART_LABEL_KEYS), cod: tp("cod"), errors: messages.errors as Record<string, string> };
  return (
    <CartCheckout
      labels={labels}
      slug={store.slug}
      locale={locale}
      zones={zones.map((z) => ({ key: z.key, name: pickText(z.name, locale), fee: z.fee, areas: z.areas.map((a) => ({ id: a.id, name: pickText(a.name, locale), fee: a.fee })) }))}
      payments={payments}
      online={online}
      whatsapp={store.whatsapp ?? store.phone ?? null}
      storeName={store.name}
      defaultCity={store.city ?? zones[0]?.key ?? ""}
    />
  );
}
