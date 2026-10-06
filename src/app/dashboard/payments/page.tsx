import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listPaymentMethods } from "@/server/services/settings";
import { isProviderAvailable } from "@/server/payments/registry";
import { PaymentToggle } from "./PaymentToggle";

export default async function PaymentsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("payments");
  const methods = await listPaymentMethods(db(), store.id);
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
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
    </div>
  );
}
