"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createProductsFromDraftsAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";

type Draft = {
  name: { ku?: string; ar?: string; en?: string };
  description: { ku?: string; ar?: string; en?: string };
  price: number | null;
  photoIndexes: number[];
};

export function AiBuilder() {
  const t = useTranslations("ai");
  const tp = useTranslations("products");
  const tc = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [urls, setUrls] = useState<string[]>([]);

  async function generate(fd: FormData) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/ai/products-from-photos", { method: "POST", body: fd });
      const j = (await res.json()) as { drafts?: Draft[]; photoUrls?: string[]; error?: string };
      if (!res.ok) return setError(j.error ?? "generic");
      setDrafts(j.drafts ?? []);
      setUrls(j.photoUrls ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAll() {
    setBusy(true);
    const payload = drafts.map((d) => ({
      name: d.name,
      description: d.description,
      price: d.price ?? 0,
      isActive: true,
      imageUrls: d.photoIndexes.map((i) => urls[i]).filter(Boolean),
    }));
    const r = await createProductsFromDraftsAction(payload);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push("/dashboard/products");
  }

  const update = (i: number, patch: Partial<Draft>) => setDrafts((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="grid gap-4">
      <form action={generate} className="card grid gap-3">
        <label className="label" htmlFor="ai-photos">{t("photos")}</label>
        <input id="ai-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
        <label className="label" htmlFor="ai-msg">{t("message")}</label>
        <textarea id="ai-msg" name="message" className="input min-h-28" placeholder={t("messagePlaceholder")} maxLength={4000} />
        <button className="btn-gold" disabled={busy}>{busy ? tc("loading") : `✨ ${t("generate")}`}</button>
      </form>
      <FormError error={error} />
      {drafts.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-bold">{t("drafts")}</h2>
          {drafts.map((d, i) => (
            <div key={i} className="card grid gap-2 sm:grid-cols-[5rem_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {urls[d.photoIndexes[0] ?? -1] ? <img src={urls[d.photoIndexes[0]!]} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <span />}
              <div className="grid gap-2">
                {(["ku", "ar", "en"] as const).map((l) => (
                  <input key={l} className="input" dir={l === "en" ? "ltr" : "rtl"} value={d.name[l] ?? ""} placeholder={`${tp("name")} (${l})`} onChange={(e) => update(i, { name: { ...d.name, [l]: e.target.value } })} />
                ))}
                <input className="input num" type="number" min={0} dir="ltr" value={d.price ?? ""} placeholder={tp("price")} onChange={(e) => update(i, { price: e.target.value ? Number(e.target.value) : null })} />
                <button type="button" className="btn-ghost btn-sm justify-self-start" onClick={() => setDrafts((l) => l.filter((_, j) => j !== i))}>{tc("delete")}</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn-gold" onClick={confirmAll} disabled={busy}>{t("confirm")}</button>
        </section>
      )}
    </div>
  );
}
