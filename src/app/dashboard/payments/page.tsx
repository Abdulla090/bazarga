import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listPaymentMethods } from "@/server/services/settings";
import { isProviderAvailable } from "@/server/payments/registry";
import { PaymentToggle } from "./PaymentToggle";
import { OnlinePaymentsCard } from "@/components/dashboard/OnlinePaymentsCard";
import { gateway } from "@/server/payments/gateway/registry";
import { sellerBalance, storeOnlineStatus } from "@/server/payments/gateway/service";
import { formatIQD } from "@/lib/money";
import { currentLocale } from "@/server/locale";

export default async function PaymentsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("payments");
  const methods = (await listPaymentMethods(db(), store.id)).filter((m) => m.method !== "online");
  const online = await storeOnlineStatus(db(), store.id);
  const balance = online.gatewayOn ? await sellerBalance(db(), store.id) : 0;
  const locale = await currentLocale();
  return (
    <div className="grid gap-3">
      <h1 className="t-headline">{t("title")}</h1>
      <p className="text-ink-70">{t("sub")}</p>
      {methods.map((m) => (
        <PaymentToggle
          key={m.method}
          method={m.method}
          enabled={m.enabled}
          available={isProviderAvailable(m.method)}
          stub={m.method === "fastpay" || m.method === "qicard"}
        />
      ))}
      <OnlinePaymentsCard
        gatewayOn={gateway() !== null}
        enabled={online.enabled}
        balance={online.gatewayOn && balance !== 0 ? formatIQD(balance, locale) : null}
        profile={online.profile ? { method: online.profile.method, accountName: online.profile.accountName, accountIdentifier: online.profile.accountIdentifier, status: online.profile.status } : null}
      />
    </div>
  );
}
