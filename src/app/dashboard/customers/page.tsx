import { getTranslations } from "next-intl/server";
import { phoneDisplay } from "@/lib/phone";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCustomers } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";

export default async function CustomersPage() {
  const { store } = await requireStore();
  const t = await getTranslations("customers");
  const locale = await currentLocale();
  const list = await listCustomers(db(), store.id);
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { dateStyle: "medium", timeZone: "Asia/Baghdad" });
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      {list.length === 0 ? (
        <p className="card text-ink-70">{t("empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {list.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{c.name}</span>
                <a href={waLink(c.phone, "")} className="num text-sm text-green underline" dir="ltr" target="_blank" rel="noopener noreferrer">{phoneDisplay(c.phone)}</a>
              </span>
              <span className="text-sm">{t("orders")}: <span className="num font-bold">{c.ordersCount}</span></span>
              <span className="text-sm">{t("spent")}: <span className="num font-bold">{formatIQD(c.totalSpent, locale)}</span></span>
              {c.lastOrderAt && <span className="num text-sm text-ink-50">{fmt.format(c.lastOrderAt)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
