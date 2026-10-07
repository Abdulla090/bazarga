import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listDiscountCodes } from "@/server/services/discounts";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { toIraqDay } from "@/lib/validation";
import { DiscountForm, DiscountToggle } from "./DiscountForms";

export default async function DiscountsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("discounts");
  const tc = await getTranslations("common");
  const locale = await currentLocale();
  const codes = await listDiscountCodes(db(), store.id);
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-ink-70">{t("sub")}</p>
      </div>
      <details className="card" open={codes.length === 0}>
        <summary className="min-h-11 cursor-pointer content-center font-bold">+ {t("new")}</summary>
        <div className="mt-3">
          <DiscountForm />
        </div>
      </details>
      {codes.length === 0 ? (
        <p className="text-ink-70">{t("none")}</p>
      ) : (
        <ul className="grid gap-3">
          {codes.map((c) => {
            const editable = c.type === "percentage" || c.type === "fixed";
            const start = toIraqDay(c.startsAt);
            const end = toIraqDay(c.endsAt, true);
            return (
              <li key={c.id} className={`card grid gap-2 ${c.isActive ? "" : "opacity-75"}`} data-testid="discount-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num min-w-0 break-all text-lg font-extrabold" dir="ltr">{c.code}</span>
                  <span className="chip bg-gold/20 px-3 text-ink">
                    <bdi className="num">{c.type === "percentage" ? `${c.value}%` : c.type === "fixed" ? formatIQD(c.value, locale) : "🚚"}</bdi>
                  </span>
                  <span className="ms-auto"><DiscountToggle id={c.id} isActive={c.isActive} /></span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-ink-70 sm:grid-cols-4">
                  <div><dt className="font-semibold">{t("minSubtotal")}</dt><dd className="num">{c.minSubtotal ? formatIQD(c.minSubtotal, locale) : "—"}</dd></div>
                  <div><dt className="font-semibold">{t("uses")}</dt><dd className="num"><bdi>{c.usedCount} / {c.maxUses ?? "∞"}</bdi></dd></div>
                  <div><dt className="font-semibold">{t("startsOn")}</dt><dd className="num" dir="ltr">{start || "—"}</dd></div>
                  <div><dt className="font-semibold">{t("endsOn")}</dt><dd className="num" dir="ltr">{end || "—"}</dd></div>
                </dl>
                {editable && (
                  <details>
                    <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">{tc("edit")}</summary>
                    <div className="mt-2">
                      <DiscountForm
                        initial={{
                          id: c.id,
                          code: c.code,
                          type: c.type as "percentage" | "fixed",
                          value: c.value,
                          minSubtotal: c.minSubtotal,
                          maxUses: c.maxUses,
                          startsOn: start,
                          endsOn: end,
                          isActive: c.isActive,
                        }}
                      />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
