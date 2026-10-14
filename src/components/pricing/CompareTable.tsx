import { getTranslations } from "next-intl/server";
import { COMPARE, PLANS, type Cell, type CellValue } from "@/lib/plans";

/** Plan comparison. Numbers render as Latin digits; strings are keys under pricing.cells.*; `soon` cells get a quiet tag. */
export async function CompareTable() {
  const t = await getTranslations("pricing");
  const value = (v: CellValue) =>
    v === true ? (
      <span role="img" aria-label="Included" className="inline-flex text-[#2563EB]">
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    ) : v === false ? (
      <span role="img" aria-label="Not included" className="text-ink-50">–</span>
    ) : typeof v === "number" ? (
      <span className="num" dir="ltr">{v}</span>
    ) : (
      t(`cells.${v}` as "cells.unlimited")
    );
  const cell = (c: Cell) =>
    typeof c === "object" ? (
      <span className="inline-flex flex-wrap items-center gap-1.5" data-soon>
        {value(c.v)}
        <span className="rounded-full border border-line px-1.5 py-px text-[0.6875rem] font-semibold leading-4 whitespace-nowrap text-ink-70">{t("soon")}</span>
      </span>
    ) : (
      value(c)
    );
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-compare>
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">{t("compare")}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="sticky start-0 z-[1] w-[28%] bg-paper py-3 text-start font-semibold"><span className="sr-only">{t("compare")}</span></th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className="py-3 pe-3 text-start font-semibold" data-col={p.id}>
                {p.premium ? (
                  <span className="inline-flex items-center rounded-full bg-[#0A0A0B] px-2.5 py-0.5 text-white ring-1 ring-[#2563EB]/70">{t(p.id)}</span>
                ) : (
                  <span className={p.highlight ? "text-[#2563EB]" : ""}>{t(p.id)}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((r) => (
            <tr key={r.key} className="border-b border-line/70" data-row={r.key}>
              <th scope="row" className="sticky start-0 z-[1] bg-paper py-3 pe-4 text-start font-medium">{t(`rows.${r.key}` as "rows.products")}</th>
              {PLANS.map((p) => (
                <td key={p.id} className={`py-3 pe-3 ${p.premium ? "bg-[#2563EB]/[0.035]" : ""}`}>{cell(r[p.id])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
