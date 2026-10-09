import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrders } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";
import { codAmount, courierDigits, courierOrderText, courierSheetText } from "@/lib/courier-sheet";

export default async function CourierSheetPage({ searchParams }: { searchParams: Promise<{ courier?: string }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("courier");
  const locale = await currentLocale();
  const { courier } = await searchParams;
  const digits = courierDigits(courier);
  const orders = await listOrders(db(), store.id, { status: "confirmed", limit: 200 });
  const cash = orders.reduce((n, o) => n + codAmount(o), 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <Link href="/dashboard/orders" className="btn-ghost btn-sm">{t("back")}</Link>
      </div>
      <p className="text-sm text-ink-70">{t("hint")}</p>
      <form method="get" className="card grid gap-2">
        <label htmlFor="courier" className="text-sm font-semibold">{t("courierPhone")}</label>
        <div className="flex gap-2">
          <input id="courier" name="courier" type="tel" inputMode="tel" dir="ltr" defaultValue={courier ?? ""} placeholder="0750 123 4567" autoComplete="off" className="input num min-w-0 flex-1" />
          <button className="btn-ghost" type="submit">{t("save")}</button>
        </div>
      </form>
      {orders.length === 0 ? (
        <p className="card text-ink-70" data-testid="courier-empty">{t("empty")}</p>
      ) : (
        <>
          <a href={waLink(digits, courierSheetText(orders, locale))} target="_blank" rel="noopener noreferrer" className="btn-primary" data-testid="courier-send-all">
            {t("sendAll", { count: orders.length })} · {formatIQD(cash, locale)}
          </a>
          <ul className="grid gap-2">
            {orders.map((o) => (
              <li key={o.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="num text-lg font-extrabold">#{o.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.customerName}</span>
                  <span className="block truncate text-sm text-ink-70">{o.cityName}{o.areaName ? ` · ${o.areaName}` : ""}</span>
                </span>
                <span className="num font-bold">{codAmount(o) > 0 ? formatIQD(codAmount(o), locale) : t("paid")}</span>
                <a href={waLink(digits, courierOrderText(o, locale))} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" data-testid="courier-send-one">
                  {t("send")}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
