"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveDomainAction, verifyDomainAction } from "@/server/actions/domain";
import { Field, FormError } from "@/components/forms/Field";
import { CopyButton } from "@/components/CopyButton";
import { useKeepValues } from "@/lib/use-keep-values";
import type { DnsRecord } from "@/lib/custom-domain";

/** Custom domain (SF7): save → DNS record to add → Verify (server DNS lookup) → Connected. */
export function DomainForm({ host, verified, record, auto }: { host: string; verified: boolean; record: DnsRecord | null; auto: boolean }) {
  const t = useTranslations("domain");
  const [saved, action, saving] = useActionState(saveDomainAction, {});
  const [check, verify, checking] = useActionState(verifyDomainAction, {});
  const keep = useKeepValues(action);
  const found = typeof check.data?.found === "string" ? check.data.found : "";
  const ok = check.ok === true || (check.ok === undefined && verified);
  return (
    <>
      <form action={action} onSubmit={keep} className="card grid gap-4" data-testid="domain-form">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold">{t("formTitle")}</h2>
          <p className="hint">{t("hint")}</p>
        </div>
        <FormError error={saved.error === "VALIDATION" ? undefined : saved.error} />
        <Field label={t("label")} name="domain" ltr inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} defaultValue={host} placeholder="shop.yourbrand.com" data-testid="domain-input" />
        <button className="btn-gold" disabled={saving} aria-busy={saving || undefined} data-testid="domain-save">{t("save")}</button>
      </form>
      {host && (
        <form action={action} className="-mt-2 flex justify-end">
          <input type="hidden" name="domain" value="" />
          <button className="btn-ghost btn-sm min-h-11" disabled={saving} data-testid="domain-remove">{t("remove")}</button>
        </form>
      )}
      {host && record && (
        <section className="card grid gap-4" data-testid="domain-steps" aria-labelledby="domain-steps-h">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="domain-steps-h" className="me-auto text-lg font-bold">{t("stepsTitle")}</h2>
            <span className={ok ? "badge-green" : "badge"} data-testid="domain-status" data-verified={ok ? "1" : "0"}>{ok ? t("verified") : t("notVerified")}</span>
          </div>
          <p className="hint">{t("stepsHint")}</p>
          <dl className="grid gap-3" data-testid="domain-record">
            {([["type", record.type], ["name", record.name], ["value", record.value]] as const).map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line p-3">
                <dt className="w-full text-sm text-ink-70 sm:w-36">{t(k)}</dt>
                <dd className="num me-auto break-all font-semibold" dir="ltr" data-testid={`domain-record-${k}`}>{v}</dd>
                {k !== "type" && <CopyButton text={v} className="btn-ghost btn-sm min-h-11 min-w-11" testId={`domain-copy-${k}`} />}
              </div>
            ))}
          </dl>
          <form action={verify} className="grid gap-3">
            <button className="btn-ink min-h-11" disabled={checking} aria-busy={checking || undefined} data-testid="domain-verify">{checking ? t("verifying") : t("verify")}</button>
          </form>
          <div role="status" aria-live="polite" className="grid gap-1" data-testid="domain-result">
            {ok ? (
              <p className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{t("verifiedHint", { host })}</p>
            ) : check.error ? (
              <>
                <FormError error={check.error} />
                <p className="hint" dir="auto">{found ? t("found", { found }) : t("foundNone")}</p>
              </>
            ) : (
              <p className="hint">{t("notVerifiedHint")}</p>
            )}
          </div>
          <p className="hint" data-testid="domain-hosting">{auto ? t("hostingAuto") : t("hostingManual")}</p>
          {ok && (
            <a href={`https://${host}`} target="_blank" rel="noopener" className="num inline-flex min-h-11 items-center break-all text-[#2563EB] underline" dir="ltr">{`https://${host}`}</a>
          )}
        </section>
      )}
    </>
  );
}
