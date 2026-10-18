"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminSetAnnouncementAction, adminSetEmailSubjectsAction, adminSetFlagAction, adminSetMaintenanceAction, adminUpdateStoreAction } from "@/server/actions/admin";
import { Btn, Card, Field, Switch, inputCls, useAdminAction, useConfirm } from "./kit";
import { ANNOUNCE_TONES, FEATURE_FLAGS, type Announcement, type FeatureFlag, type Maintenance } from "@/lib/admin";
import { ANNOUNCE_TONE_CLASS, AnnouncementBar } from "@/components/site/AnnouncementBar";

const LANGS = [["en", "English"], ["ku", "کوردی (سۆرانی)"], ["ar", "العربية"], ["kmr", "Kurmancî"]] as const;

export function SiteControls({ flags, maintenance, announcement, subjects, featured }: {
  flags: Record<FeatureFlag, boolean>;
  maintenance: Maintenance;
  announcement: Announcement;
  subjects: Record<string, string>;
  featured: { id: string; name: string; slug: string; showcaseOptIn: boolean }[];
}) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  const confirm = useConfirm();
  const [fl, setFl] = useState(flags);
  const [mOn, setMOn] = useState(maintenance.on);
  const [mMsg, setMMsg] = useState(maintenance.message);
  const [ann, setAnn] = useState<Announcement>(announcement);
  const [subj, setSubj] = useState({ reset: subjects.reset ?? "", verify: subjects.verify ?? "" });

  const flip = async (f: FeatureFlag, on: boolean) => {
    setFl((x) => ({ ...x, [f]: on })); // optimistic
    const r = await run(() => adminSetFlagAction({ flag: f, on }));
    if (!r.ok) setFl((x) => ({ ...x, [f]: !on }));
  };
  const setMaint = (on: boolean) => {
    if (on) confirm({ title: t("site.maint"), body: t("site.maintHint"), expected: "maintenance", confirmLabel: t("c.on"), onConfirm: async (p) => { const r = await run(() => adminSetMaintenanceAction({ on: true, message: mMsg, ...p })); if (r.ok) setMOn(true); return r; } });
    else run(() => adminSetMaintenanceAction({ on: false, message: mMsg })).then((r) => r.ok && setMOn(false));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t("site.maint")} testId="site-maintenance" className={mOn ? "border-[#FEC84B] bg-[#FFFCF5]" : ""} action={<Switch on={mOn} onChange={setMaint} label={t("site.maint")} testId="maint-switch" disabled={pending} />}>
        <p className="mb-3 text-sm text-ink-70">{t("site.maintHint")}</p>
        <Field label={t("site.maintMsg")}><input className={inputCls} value={mMsg} onChange={(e) => setMMsg(e.target.value)} maxLength={500} /></Field>
        {mOn && <Btn className="mt-3" onClick={() => run(() => adminSetMaintenanceAction({ on: true, message: mMsg, confirm: "maintenance" }))} disabled={pending}>{t("c.save")}</Btn>}
      </Card>

      <Card title={t("site.flags")} testId="site-flags">
        <p className="mb-2 text-xs text-ink-50">{t("site.flagsHint")}</p>
        <ul className="divide-y divide-line">
          {FEATURE_FLAGS.map((f) => (
            <li key={f} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span>{t(`site.flag.${f}`)}</span>
              <Switch on={fl[f]} onChange={(v) => flip(f, v)} label={t(`site.flag.${f}`)} testId={`flag-switch-${f}`} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t("site.announce")} testId="site-announcement" className="lg:col-span-2" action={<Switch on={ann.on} onChange={(v) => setAnn({ ...ann, on: v })} label={t("site.announce")} testId="announce-switch" />}>
        <p className="mb-3 text-sm text-ink-70">{t("site.announceHint")}</p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => adminSetAnnouncementAction({ on: ann.on, tone: ann.tone, href: ann.href ?? "", text: ann.text as Record<string, string> })); }}>
          {LANGS.map(([l, label]) => (
            <Field key={l} label={t("site.text", { lang: label })}>
              <input className={inputCls} dir={l === "ku" || l === "ar" ? "rtl" : "ltr"} lang={l === "kmr" ? "ku-Latn" : l} value={ann.text[l] ?? ""} maxLength={280} onChange={(e) => setAnn({ ...ann, text: { ...ann.text, [l]: e.target.value } })} data-testid={`announce-${l}`} />
            </Field>
          ))}
          <Field label={t("site.link")}><input className={inputCls} dir="ltr" value={ann.href ?? ""} placeholder="/pricing" onChange={(e) => setAnn({ ...ann, href: e.target.value })} /></Field>
          <Field label={t("site.tone")}>
            <span className="flex flex-wrap gap-2">
              {ANNOUNCE_TONES.map((c) => (
                <button key={c} type="button" aria-pressed={ann.tone === c} aria-label={c} onClick={() => setAnn({ ...ann, tone: c })} className={`grid size-11 place-items-center rounded-full border ${ann.tone === c ? "border-ink" : "border-line"}`}>
                  <span className={`size-6 rounded-full ${ANNOUNCE_TONE_CLASS[c]}`} />
                </button>
              ))}
            </span>
          </Field>
          <div className="md:col-span-2">
            <p className="mb-1 text-xs text-ink-50">{t("site.preview")}</p>
            <div className="overflow-hidden rounded-xl border border-line"><AnnouncementBar text={ann.text.en || Object.values(ann.text).find(Boolean) || "…"} tone={ann.tone} href={ann.href} /></div>
          </div>
          <div><Btn type="submit" tone="primary" disabled={pending} data-testid="announce-save">{t("c.save")}</Btn></div>
        </form>
      </Card>

      <Card title={t("site.featured")} testId="site-featured">
        <p className="mb-2 text-xs text-ink-50">{t("site.featuredHint")}</p>
        <ul className="divide-y divide-line text-sm">
          {featured.length === 0 && <li className="py-3 text-ink-50">{t("c.none")}</li>}
          {featured.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-1.5">
              <Link href={`/admin/stores/${s.id}`} className="min-w-0 flex-1 truncate hover:text-[#2563EB]">{s.name} <span className="text-ink-50" dir="ltr">/{s.slug}</span></Link>
              {!s.showcaseOptIn && <span className="text-xs text-ink-50">opt-in: {t("c.no")}</span>}
              <Btn onClick={() => run(() => adminUpdateStoreAction({ id: s.id, featured: false }))} disabled={pending}>{t("s.unfeature")}</Btn>
            </li>
          ))}
        </ul>
        <Link href="/admin/stores" className="mt-2 inline-flex min-h-11 items-center text-sm text-[#2563EB]">{t("s.feature")} →</Link>
      </Card>

      <Card title={t("site.subjects")} testId="site-subjects">
        <p className="mb-2 text-xs text-ink-50">{t("site.subjectsHint")}</p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => adminSetEmailSubjectsAction(subj)); }}>
          <Field label={t("site.subject.reset")}><input className={inputCls} value={subj.reset} maxLength={140} onChange={(e) => setSubj({ ...subj, reset: e.target.value })} /></Field>
          <Field label={t("site.subject.verify")}><input className={inputCls} value={subj.verify} maxLength={140} onChange={(e) => setSubj({ ...subj, verify: e.target.value })} /></Field>
          <Btn type="submit" tone="primary" disabled={pending}>{t("c.save")}</Btn>
        </form>
      </Card>
    </div>
  );
}
