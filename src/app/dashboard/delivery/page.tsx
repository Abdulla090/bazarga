import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listAreas, listZones } from "@/server/services/settings";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { AddZoneForm, AreaForm, ZoneRow } from "./ZoneForms";

export default async function DeliveryPage() {
  const { store } = await requireStore();
  const t = await getTranslations("delivery");
  const locale = await currentLocale();
  const [zones, areas] = await Promise.all([listZones(db(), store.id), listAreas(db(), store.id)]);
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-ink-70">{t("sub")}</p>
      {zones.map((z) => {
        const zoneAreas = areas.filter((a) => a.zoneId === z.id);
        const name = pickText(z.name, locale);
        return (
          <section key={z.id} className="grid gap-2" aria-label={name}>
            <ZoneRow id={z.id} name={name} fee={z.fee} isActive={z.isActive} />
            <details className="ms-3 grid gap-2" data-testid="zone-areas">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-ink-70">
                {t("areas")} <span className="num">({zoneAreas.length})</span>
              </summary>
              <div className="grid gap-2">
                <p className="hint">{zoneAreas.length ? t("areasHint") : t("noAreas")}</p>
                {zoneAreas.map((a) => (
                  <AreaForm key={a.id} zoneId={z.id} cityFee={z.fee} area={{ id: a.id, name: a.name, fee: a.fee }} />
                ))}
                <AreaForm zoneId={z.id} cityFee={z.fee} />
              </div>
            </details>
          </section>
        );
      })}
      <h2 className="mt-4 font-bold">{t("add")}</h2>
      <AddZoneForm />
    </div>
  );
}
