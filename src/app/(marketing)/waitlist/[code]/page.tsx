import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistSpot } from "@/components/marketing/WaitlistSpot";
import { db } from "@/server/db";
import { waitlistStatus } from "@/server/services/waitlist";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return { title: t("wlStatusTitle"), robots: { index: false, follow: false } };
}

/** Public, unlisted status page for one signup (the code is the secret): rank, referral link and share buttons. */
export default async function WaitlistStatusPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const s = await waitlistStatus(db(), code);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only">{tc("skipToContent")}</a>
      <SiteHeader />
      <main id="main" className="container-page max-w-xl py-14">
        <h1 className="mb-6 text-3xl font-extrabold">{t("wlStatusTitle")}</h1>
        {s ? (
          <WaitlistSpot name={s.firstName} code={s.refCode} position={s.position} total={s.total} referrals={s.referrals} returning />
        ) : (
          <div className="card text-center">
            <p className="text-ink-70">{t("wlStatusMissing")}</p>
            <Link href="/#join" className="btn-gold mt-5">{t("wlStatusJoin")}</Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
