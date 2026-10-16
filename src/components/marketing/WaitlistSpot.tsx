"use client";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/CopyButton";
import { WAITLIST_REFERRAL_BOOST, referralLink } from "@/lib/waitlist";

const subscribe = () => () => {};
const origin = () => window.location.origin;
const serverOrigin = () => "";

/** Position card shown after joining and on /waitlist/<code>: big rank, the personal link, copy + WhatsApp share. */
export function WaitlistSpot({
  name,
  code,
  position,
  total,
  referrals,
  returning = false,
}: {
  name: string;
  code: string;
  position: number;
  total: number;
  referrals: number;
  returning?: boolean;
}) {
  const t = useTranslations("landing");
  const nf = new Intl.NumberFormat("en-US");
  const base = useSyncExternalStore(subscribe, origin, serverOrigin);
  const link = referralLink(base || "https://bazarga.vercel.app", code);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t("wlShare")} ${link}`)}`;
  return (
    <div className="card text-center" role="status" data-testid="waitlist-spot">
      <p className="text-2xl font-bold">{returning ? t("wlBack", { name }) : t("wlThanks", { name })}</p>
      <div className="mx-auto mt-5 w-full max-w-xs rounded-2xl border border-line bg-paper px-5 py-4">
        <p className="text-sm font-medium text-ink-70">{t("wlSpot")}</p>
        <p className="num mt-1 text-5xl font-extrabold tracking-tight text-gold" data-testid="waitlist-position" dir="ltr">#{nf.format(position)}</p>
        <p className="mt-1 text-sm text-ink-70">{t("wlOf", { total: nf.format(total) })}</p>
      </div>
      <p className="mt-5 text-ink-70">{t("wlBoost", { n: WAITLIST_REFERRAL_BOOST })}</p>
      <div className="mt-4 text-start">
        <p className="label">{t("wlLink")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly dir="ltr" value={link} aria-label={t("wlLink")} className="input num min-w-0 flex-1" data-testid="waitlist-link" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton text={link} className="btn-ink min-h-11" testId="waitlist-copy" />
        </div>
      </div>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold mt-4 w-full">{t("wlWa")}</a>
      <p className="num mt-4 text-sm text-ink-70">{t("wlFriends", { n: nf.format(referrals) })}</p>
    </div>
  );
}
