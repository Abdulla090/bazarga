import { getTranslations } from "next-intl/server";
import { ErrorState, SUPPORT_EMAIL } from "@/components/ErrorState";

/** 404 inside the dashboard chrome (a deleted product/order id, a mistyped dashboard URL). */
export default async function DashboardNotFound() {
  const t = await getTranslations("notFound");
  return (
    <ErrorState
      testId="dashboard-not-found"
      eyebrow={t("eyebrow")}
      title={t("dashTitle")}
      body={t("dashBody")}
      actions={[{ href: "/dashboard", label: t("dashHome"), primary: true }]}
      help={{ href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL, text: t("help") }}
    />
  );
}
