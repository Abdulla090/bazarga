"use client";
import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";
import { LOCALE_LABEL } from "@/lib/i18n";

type Cat = { id?: string; name: Record<string, string | undefined>; sort: number };

export function CategoryForm({ cat }: { cat?: Cat }) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveCategoryAction, {});
  const [delPending, start] = useTransition();
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-[1fr_1fr_1fr_5rem_auto] sm:items-end">
      {cat?.id && <input type="hidden" name="id" value={cat.id} />}
      {(["ku", "ar", "en"] as const).map((l) => (
        <div key={l}>
          <label className="label" htmlFor={`c-${cat?.id ?? "new"}-${l}`}>{t("name")} · {LOCALE_LABEL[l]}</label>
          <input id={`c-${cat?.id ?? "new"}-${l}`} name={`name.${l}`} defaultValue={cat?.name[l] ?? ""} className="input" dir={l === "en" ? "ltr" : "rtl"} maxLength={80} />
        </div>
      ))}
      <div>
        <label className="label" htmlFor={`c-${cat?.id ?? "new"}-sort`}>{t("sort")}</label>
        <input id={`c-${cat?.id ?? "new"}-sort`} name="sort" type="number" defaultValue={cat?.sort ?? 0} className="input num" />
      </div>
      <div className="flex gap-2">
        <button className="btn-gold btn-sm" disabled={pending}>{cat?.id ? tc("save") : tc("add")}</button>
        {cat?.id && (
          <button type="button" className="btn-danger btn-sm" disabled={delPending} onClick={() => confirm(tc("confirmDelete")) && start(() => deleteCategoryAction(cat.id!))}>
            {tc("delete")}
          </button>
        )}
      </div>
      <div className="sm:col-span-5">
        <FormError error={state.fieldErrors?.name ? "name_required" : state.error === "VALIDATION" ? undefined : state.error} />
      </div>
    </form>
  );
}
