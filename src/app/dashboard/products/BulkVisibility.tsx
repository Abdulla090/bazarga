"use client";
import { useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { bulkProductVisibilityAction, bulkProductSaleAction } from "@/server/actions/dashboard";

export function BulkVisibility({ ids }: { ids: string[] }) {
  const t = useTranslations("products");
  const f = useFormatter();
  const [pending, start] = useTransition();
  const run = (active: boolean) => start(async () => { await bulkProductVisibilityAction(ids, active); });
  const sale = (pct: number | null) => start(async () => { await bulkProductSaleAction(ids, pct); });
  const cls = "btn-ghost btn-sm min-h-11 leading-normal";
  return (
    <div className="flex flex-wrap gap-2" data-testid="products-bulk">
      <button type="button" disabled={pending} onClick={() => run(false)} className={cls}>{t("hideAll")}</button>
      <button type="button" disabled={pending} onClick={() => run(true)} className={cls}>{t("showAll")}</button>
      {[10, 20, 30, 50].map((p) => (
        <button key={p} type="button" disabled={pending} onClick={() => sale(p)} className={cls} data-testid={`bulk-sale-${p}`}>
          {f.number(p / 100, { style: "percent" })}
        </button>
      ))}
      <button type="button" disabled={pending} onClick={() => sale(null)} className={cls}>{t("endSale")}</button>
    </div>
  );
}
