import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { SETTING_KEYS, getAnnouncement, getFlags, getMaintenance, getSetting } from "@/server/services/platform-settings";
import { SiteControls } from "@/components/admin/SiteControls";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Site", robots: { index: false } };

export default async function AdminSite() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const [flags, maint, ann, subjects, featured] = await Promise.all([
    getFlags(db()),
    getMaintenance(db()),
    getAnnouncement(db()),
    getSetting(db(), SETTING_KEYS.emailSubjects),
    db().select({ id: stores.id, name: stores.name, slug: stores.slug, showcaseOptIn: stores.showcaseOptIn }).from(stores).where(eq(stores.featured, true)).limit(50),
  ]);
  return (
    <div>
      <PageHeader title={t("nav.site")} />
      <SiteControls flags={flags} maintenance={maint} announcement={ann} subjects={(subjects ?? {}) as Record<string, string>} featured={featured} />
    </div>
  );
}
