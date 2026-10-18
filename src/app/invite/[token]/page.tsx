import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { findInvite } from "@/server/services/team";
import { IntlProvider } from "@/components/IntlProvider";
import { Logo } from "@/components/Logo";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata = { title: "Team invite", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("team");
  const [inv, user] = await Promise.all([findInvite(db(), token), currentUser()]);
  const next = `/invite/${token}`;
  return (
    <IntlProvider>
      <div className="min-h-dvh">
        <header className="container-page py-4"><Logo /></header>
        <main className="container-page grid max-w-md gap-4 py-8" data-testid="invite-page">
          {!inv ? (
            <>
              <h1 className="t-headline">{t("inviteInvalidTitle")}</h1>
              <p className="text-ink-70">{t("inviteInvalid")}</p>
            </>
          ) : (
            <>
              <h1 className="t-headline">{t("inviteHeading", { store: inv.storeName })}</h1>
              <p className="text-ink-70">{t("inviteFor", { email: inv.email })}</p>
              {user ? (
                user.email.toLowerCase() === inv.email ? (
                  <AcceptInviteForm token={token} />
                ) : (
                  <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">{t("wrongAccount", { email: inv.email })}</p>
                )
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn-gold inline-flex min-h-11 items-center">{t("signupToJoin")}</Link>
                  <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-ghost inline-flex min-h-11 items-center">{t("loginToJoin")}</Link>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </IntlProvider>
  );
}
