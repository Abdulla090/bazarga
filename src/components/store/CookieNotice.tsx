"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { safePixelId } from "@/lib/pixels-client";

export const CONSENT_KEY = "bz-pixel-consent";

/** True unless the shopper declined the seller's ad pixels. */
export function pixelsConsented(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) !== "no";
  } catch {
    return true;
  }
}

/** Small notice shown only on stores that run a TikTok / Meta pixel. Declining stops the pixels for good. */
export function CookieNotice({ tiktokId, metaId }: { tiktokId: string | null; metaId: string | null }) {
  const t = useTranslations("store.cookie");
  const [open, setOpen] = useState(false);
  const has = Boolean(safePixelId("tiktok", tiktokId) || safePixelId("meta", metaId));

  useEffect(() => {
    if (!has) return;
    const id = window.setTimeout(() => {
      try {
        if (!window.localStorage.getItem(CONSENT_KEY)) setOpen(true);
      } catch {
        /* private mode: stay quiet */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [has]);

  if (!open) return null;
  const answer = (v: "yes" | "no") => {
    try {
      window.localStorage.setItem(CONSENT_KEY, v);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  return (
    <div role="region" aria-label={t("title")} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-4 text-sm text-neutral-900 shadow-xl">
      <p className="font-semibold">{t("title")}</p>
      <p className="mt-1 text-neutral-600">{t("body")}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => answer("yes")} className="min-h-11 flex-1 rounded-xl bg-[#2563EB] px-4 font-semibold text-white">{t("accept")}</button>
        <button type="button" onClick={() => answer("no")} className="min-h-11 flex-1 rounded-xl border border-black/15 px-4 font-semibold">{t("decline")}</button>
      </div>
    </div>
  );
}
