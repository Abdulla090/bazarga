import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { emailDelivers } from "@/server/email";
import { SUPPORT_EMAIL } from "@/components/ErrorState";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

/**
 * While EMAIL_PROVIDER is console (no provider key on Vercel) a reset link would only reach the server log, so the page
 * says so honestly and points to support instead of pretending a mail is on its way. Setting EMAIL_PROVIDER +
 * EMAIL_API_KEY brings the normal form back with no code change.
 */
export default async function ForgotPasswordPage() {
  if (emailDelivers()) return <ForgotPasswordForm />;
  const t = await getTranslations("auth");
  return (
    <div className="grid gap-5 border-t border-[#E7E5E4] pt-8" data-testid="forgot-no-email">
      <div>
        <h1 className="t-headline">{t("forgotTitle")}</h1>
        <p className="text-ink-70">{t("forgotNoEmail")}</p>
      </div>
      <a href={`mailto:${SUPPORT_EMAIL}?subject=Password%20reset`} className="btn-gold justify-center" dir="ltr">{SUPPORT_EMAIL}</a>
      <p className="text-sm text-ink-70">{t("forgotNoEmailHint")}</p>
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm underline">{t("login")}</Link>
    </div>
  );
}
