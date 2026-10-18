"use client";
import { useTranslations } from "next-intl";
import { adminUpgradeDecisionAction } from "@/server/actions/admin";
import { Btn, useAdminAction } from "./kit";

export function UpgradeButtons({ id }: { id: string }) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  return (
    <span className="flex gap-2">
      <Btn tone="primary" disabled={pending} onClick={() => run(() => adminUpgradeDecisionAction({ id, decision: "activate" }))} data-testid="upgrade-activate">{t("pl.activate")}</Btn>
      <Btn disabled={pending} onClick={() => run(() => adminUpgradeDecisionAction({ id, decision: "reject" }))}>{t("pl.reject")}</Btn>
    </span>
  );
}
