import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listZones } from "@/server/services/settings";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { AddZoneForm, ZoneRow } from "./ZoneForms";

export default async function DeliveryPage() {
  const { store } = await requireStore();
  const t = await getTranslations("delivery");
  const locale = await currentLocale();
  const zones = await listZones(db(), store.id);
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-ink-70">{t("sub")}</p>
      {zones.map((z) => (
        <ZoneRow key={z.id} id={z.id} name={pickText(z.name, locale)} fee={z.fee} isActive={z.isActive} />
      ))}
      <h2 className="mt-4 font-bold">{t("add")}</h2>
      <AddZoneForm />
    </div>
  );
}
