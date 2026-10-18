import { getTranslations } from "next-intl/server";
import { currentUser } from "@/server/auth/session";
import { endImpersonationAction } from "@/server/actions/admin";

/** Orange "Viewing as …" bar with Return to admin, on every seller page of an admin view-as session (docs/ADMIN.md). */
export async function ImpersonationBanner() {
  const user = await currentUser();
  if (!user?.impersonatedBy) return null;
  const t = await getTranslations("admin");
  return (
    <form action={endImpersonationAction} className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-[#B54708] px-4 py-2 text-sm text-white print:hidden" data-testid="impersonation-banner">
      <span>{t("imp.banner", { name: user.name, email: user.email })}</span>
      <button className="min-h-11 rounded-full bg-white px-4 font-medium text-[#B54708]" data-testid="impersonation-end">{t("imp.end")}</button>
    </form>
  );
}
