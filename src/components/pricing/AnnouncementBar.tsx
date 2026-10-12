import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function AnnouncementBar() {
  const t = await getTranslations("pricing");
  return (
    <div className="bg-ink text-paper">
      <Link href="/pricing" className="container-page flex min-h-10 items-center justify-center gap-2 py-2 text-center text-xs font-medium sm:text-sm">
        <span>{t("bar")}</span>
        <span className="font-semibold underline underline-offset-4">{t("barCta")}</span>
      </Link>
    </div>
  );
}
