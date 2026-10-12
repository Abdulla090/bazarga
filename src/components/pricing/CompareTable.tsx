import { getTranslations } from "next-intl/server";
import { COMPARE, PLANS } from "@/lib/plans";

export async function CompareTable() {
  const t = await getTranslations("pricing");
  const cell = (v: boolean | string) =>
    v === true ? <span role="img" aria-label="Included" className="text-[#2563EB]"><svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span> : v === false ? <span role="img" aria-label="Not included" className="text-ink-70">–</span> : t(`cells.${v}` as "cells.c15");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{t("compare")}</caption>
        <thead>
          <tr className="border-b border-line text-start">
            <th scope="col" className="py-3 text-start font-semibold"><span className="sr-only">{t("compare")}</span></th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className={`py-3 text-start font-semibold ${p.highlight ? "text-[#2563EB]" : ""}`}>{t(p.id)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((r) => (
            <tr key={r.key} className="border-b border-line/70">
              <th scope="row" className="py-3 pe-4 text-start font-medium">{t(`rows.${r.key}` as "rows.products")}</th>
              <td className="py-3 pe-4">{cell(r.free)}</td>
              <td className="py-3 pe-4">{cell(r.pro)}</td>
              <td className="py-3 pe-4">{cell(r.business)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
