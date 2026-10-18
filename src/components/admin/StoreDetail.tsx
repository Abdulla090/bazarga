"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  adminDeleteStoreAction,
  adminResetThemeAction,
  adminSetOverrideAction,
  adminSetPlanAction,
  adminSuspendStoreAction,
  adminTransferStoreAction,
  adminUpdateStoreAction,
} from "@/server/actions/admin";
import { Badge, Btn, Card, Field, Switch, fmtDate, inputCls, selectCls, useAdminAction, useConfirm } from "./kit";
import { LIMIT_KEYS, type LimitKey } from "@/lib/admin";
import { PLAN_IDS } from "@/lib/plans";

type S = { id: string; name: string; slug: string; phone: string | null; whatsapp: string | null; instagram: string | null; city: string | null; plan: string; planPeriodEnd: string | null; isActive: boolean; suspendedAt: string | null; suspendedReason: string | null; featured: boolean; showcaseOptIn: boolean; whiteLabel: boolean; themePreset: string; hasTheme: boolean; createdAt: string };

export function StoreDetail({ store, owner, counts, planDefaults, override, history, audit }: {
  store: S;
  owner: { id: string; email: string; name: string } | null;
  counts: { products: number; orders: number; members: number };
  planDefaults: Record<LimitKey, number>;
  override: (Partial<Record<LimitKey, number | null>> & { note: string | null }) | null;
  history: { id: string; from: string; to: string; end: string | null; reason: string; at: string }[];
  audit: { id: string; action: string; actor: string; at: string }[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const confirm = useConfirm();
  const [f, setF] = useState({ name: store.name, slug: store.slug, phone: store.phone ?? "", whatsapp: store.whatsapp ?? "", instagram: store.instagram ?? "", city: store.city ?? "" });
  const [flags, setFlags] = useState({ isActive: store.isActive, featured: store.featured, showcaseOptIn: store.showcaseOptIn, whiteLabel: store.whiteLabel });
  const [plan, setPlan] = useState(store.plan);
  const [until, setUntil] = useState(store.planPeriodEnd?.slice(0, 10) ?? "");
  const [lim, setLim] = useState<Record<LimitKey, string>>(Object.fromEntries(LIMIT_KEYS.map((k) => [k, override?.[k] == null ? "" : String(override[k])])) as Record<LimitKey, string>);
  const [note, setNote] = useState(override?.note ?? "");
  const [newOwner, setNewOwner] = useState("");
  const [reason, setReason] = useState("");

  const flip = async (k: keyof typeof flags, v: boolean) => {
    setFlags((x) => ({ ...x, [k]: v }));
    const r = await run(() => adminUpdateStoreAction({ id: store.id, [k]: v }));
    if (!r.ok) setFlags((x) => ({ ...x, [k]: !v }));
  };

  return (
    <div className="space-y-4" data-testid="store-detail">
      <Link href="/admin/stores" className="inline-flex min-h-11 items-center text-sm text-ink-50 hover:text-ink">← {t("s.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{store.name}</h1>
          <p className="text-sm text-ink-70"><span dir="ltr">/{store.slug}</span>{owner && <> · <Link className="hover:text-[#2563EB]" href={`/admin/users/${owner.id}`} dir="ltr">{owner.email}</Link></>}</p>
        </div>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={store.plan === "free" ? "gray" : "blue"}>{store.plan}</Badge>
          {store.suspendedAt ? <Badge tone="amber">{t("s.state.suspended")}</Badge> : flags.isActive ? <Badge tone="green">{t("s.state.live")}</Badge> : <Badge>{t("s.state.unpublished")}</Badge>}
          {flags.featured && <Badge tone="ink">{t("s.state.featured")}</Badge>}
        </span>
        <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm hover:border-ink/30">{t("s.openStore")} ↗</a>
      </div>
      {store.suspendedAt && <p className="rounded-2xl border border-[#FEC84B] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]" data-testid="store-suspended">{t("s.suspendedBanner", { date: fmtDate(store.suspendedAt) })}{store.suspendedReason ? ` · ${store.suspendedReason}` : ""}</p>}

      <div className="grid grid-cols-3 gap-3">
        {([["s.products", counts.products], ["s.orders", counts.orders], ["s.lim.seats", counts.members]] as const).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white p-3"><p className="text-xs text-ink-50">{t(k)}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("s.settings")}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => adminUpdateStoreAction({ id: store.id, ...f })); }}>
            <Field label={t("c.name")}><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="store-name" /></Field>
            <Field label={t("s.slug")}><input className={inputCls} dir="ltr" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
            <Field label={t("c.phone")}><input className={inputCls} dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label={t("s.whatsapp")}><input className={inputCls} dir="ltr" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
            <Field label={t("s.instagram")}><input className={inputCls} dir="ltr" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></Field>
            <Field label={t("s.city")}><input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Btn type="submit" tone="primary" disabled={pending} data-testid="store-save">{t("c.save")}</Btn></div>
          </form>
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {([["isActive", "s.published"], ["featured", "s.feature"], ["showcaseOptIn", "s.showcase"], ["whiteLabel", "s.whiteLabel"]] as const).map(([k, label]) => (
              <li key={k} className="flex items-center justify-between py-1 text-sm">{t(label)}<Switch on={flags[k]} onChange={(v) => flip(k, v)} label={t(label)} testId={`store-flag-${k}`} disabled={pending} /></li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title={t("s.planTitle")} testId="store-plan">
            <p className="mb-3 text-sm text-ink-70">{store.plan} · {t("s.until")} {store.planPeriodEnd ? fmtDate(store.planPeriodEnd) : store.plan === "free" ? "—" : t("s.openEnded")}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={t("c.plan")}><select className={`${selectCls} w-full`} value={plan} onChange={(e) => setPlan(e.target.value)} data-testid="plan-select">{PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
              <Field label={t("s.until")}><input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} dir="ltr" /></Field>
              <Btn tone="primary" disabled={pending} data-testid="plan-set" onClick={() => run(() => adminSetPlanAction({ id: store.id, plan, periodEnd: until || null, reason: until ? "grant" : "comp" }))}>{t("s.setPlan")}</Btn>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn disabled={pending || plan === "free"} onClick={() => run(() => adminSetPlanAction({ id: store.id, plan, months: 1, reason: "extend" }))}>{t("s.extend1")}</Btn>
              <Btn disabled={pending || plan === "free"} onClick={() => run(() => adminSetPlanAction({ id: store.id, plan, months: 12, reason: "extend" }))}>{t("s.extend12")}</Btn>
              <Btn disabled={pending || plan === "free"} onClick={() => run(() => adminSetPlanAction({ id: store.id, plan, periodEnd: null, reason: "comp" }))}>{t("s.comp")}</Btn>
            </div>
            {history.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="min-h-11 cursor-pointer py-2 text-ink-70">{t("s.history")}</summary>
                <ul className="space-y-1 text-xs text-ink-70">{history.map((h) => <li key={h.id}>{fmtDate(h.at, true)} · {h.from} → {h.to}{h.end ? ` (${fmtDate(h.end)})` : ""} · {h.reason}</li>)}</ul>
              </details>
            )}
          </Card>

          <Card title={t("s.limits")} testId="store-limits">
            <p className="mb-3 text-xs text-ink-50">{t("s.limitsHint")}</p>
            <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); run(() => adminSetOverrideAction({ storeId: store.id, ...lim, note })); }}>
              {LIMIT_KEYS.map((k) => (
                <Field key={k} label={t(`s.lim.${k}`)}>
                  <input inputMode="numeric" className={inputCls} dir="ltr" value={lim[k]} placeholder={String(planDefaults[k])} onChange={(e) => setLim({ ...lim, [k]: e.target.value.replace(/[^\d]/g, "") })} data-testid={`limit-${k}`} />
                </Field>
              ))}
              <Field label={t("s.note")}><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="col-span-2"><Btn type="submit" tone="primary" disabled={pending} data-testid="limits-save">{t("c.save")}</Btn></div>
            </form>
          </Card>
        </div>
      </div>

      <Card title={t("u.danger")} className="border-[#FECDCA]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {store.suspendedAt ? (
              <Btn tone="primary" disabled={pending} data-testid="store-unsuspend" onClick={() => run(() => adminSuspendStoreAction({ id: store.id, suspended: false }))}>{t("s.unsuspend")}</Btn>
            ) : (
              <>
                <Field label={t("s.suspendReason")}><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <Btn tone="danger" disabled={pending} data-testid="store-suspend" onClick={() => confirm({ title: t("s.suspend"), expected: store.slug, confirmLabel: t("s.suspend"), onConfirm: (p) => run(() => adminSuspendStoreAction({ id: store.id, suspended: true, reason, ...p })) })}>{t("s.suspend")}</Btn>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Field label={t("s.newOwner")}><input className={inputCls} dir="ltr" type="email" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} /></Field>
            <Btn tone="danger" disabled={pending || !newOwner} onClick={() => confirm({ title: t("s.transfer"), expected: store.slug, confirmLabel: t("s.transfer"), onConfirm: (p) => run(() => adminTransferStoreAction({ id: store.id, email: newOwner, ...p })) })}>{t("s.transfer")}</Btn>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Btn tone="danger" disabled={pending} onClick={() => confirm({ title: t("s.resetTheme"), expected: store.slug, confirmLabel: t("s.resetTheme"), onConfirm: (p) => run(() => adminResetThemeAction({ id: store.id, ...p })) })}>{t("s.resetTheme")}</Btn>
          <Btn tone="danger" disabled={pending} data-testid="store-delete" onClick={() => confirm({
            title: t("s.deleteStore"), body: t("confirm.irreversible"), expected: store.slug, confirmLabel: t("c.delete"),
            onConfirm: async (p) => { const r = await run(() => adminDeleteStoreAction({ id: store.id, ...p })); if (r.ok) router.push("/admin/stores"); return r; },
          })}>{t("s.deleteStore")}</Btn>
        </div>
      </Card>

      <Card title={t("a.title")}>
        <ul className="divide-y divide-line text-sm">
          {audit.length === 0 && <li className="py-3 text-ink-50">{t("c.none")}</li>}
          {audit.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 py-2"><span className="font-mono text-xs">{a.action}</span><span className="text-ink-50" dir="ltr">{a.actor}</span><span className="ms-auto text-xs text-ink-50">{fmtDate(a.at, true)}</span></li>)}
        </ul>
      </Card>
    </div>
  );
}
