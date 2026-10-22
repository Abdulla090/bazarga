import { getTranslations } from "next-intl/server";
import { ErrorState, SUPPORT_EMAIL } from "@/components/ErrorState";

/** 404 inside the admin chrome (a deleted user/store id or mistyped admin URL) instead of the bare platform 404. */
export default async function AdminNotFound() {
  const t = await getTranslations("notFound");
  return (
    <ErrorState
      testId="admin-not-found"
      eyebrow={t("eyebrow")}
      title={t("dashTitle")}
      body={t("dashBody")}
      actions={[{ href: "/admin", label: t("dashHome"), primary: true }]}
      help={{ href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL, text: t("help") }}
    />
  );
}
