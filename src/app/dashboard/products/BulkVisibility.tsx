"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { bulkProductVisibilityAction } from "@/server/actions/dashboard";

export function BulkVisibility({ ids }: { ids: string[] }) {
  const t = useTranslations("products");
  const [pending, start] = useTransition();
  const run = (active: boolean) => start(async () => { await bulkProductVisibilityAction(ids, active); });
  const cls = "btn-ghost btn-sm min-h-11 leading-normal";
  return (
    <div className="flex flex-wrap gap-2" data-testid="products-bulk">
      <button type="button" disabled={pending} onClick={() => run(false)} className={cls}>{t("hideAll")}</button>
      <button type="button" disabled={pending} onClick={() => run(true)} className={cls}>{t("showAll")}</button>
    </div>
  );
}
