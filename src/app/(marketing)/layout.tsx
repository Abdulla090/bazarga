import { getTranslations } from "next-intl/server";
import { IntlProvider } from "@/components/IntlProvider";
import { AnnouncementBar } from "@/components/site/AnnouncementBar";
import { StatusPage } from "@/components/site/StatusPage";
import { announcementFor, maintenanceFor } from "@/server/admin/site-gate";
import { currentLocale } from "@/server/locale";
import "./marketing.css";

/** Landing page: the waitlist form is a next-intl client component, so this area gets client messages. Admin maintenance mode + announcement apply here. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [maint, locale] = await Promise.all([maintenanceFor(), currentLocale()]);
  if (maint) {
    const t = await getTranslations("site");
    return <StatusPage title={t("maintenance.title")} body={maint.message || t("maintenance.body")} testId="maintenance-page" />;
  }
  const ann = await announcementFor(locale);
  return (
    <IntlProvider>
      {ann && <AnnouncementBar {...ann} />}
      {children}
    </IntlProvider>
  );
}
