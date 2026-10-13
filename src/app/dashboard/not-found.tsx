import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function DashboardNotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-4 py-16 text-center" data-testid="dashboard-not-found">
      <p className="num text-5xl font-extrabold text-gold">404</p>
      <p className="text-lg">{t("NOT_FOUND")}</p>
      <Link href="/dashboard" className="btn-gold min-h-11 px-6">Dashboard</Link>
    </div>
  );
}
