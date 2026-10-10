import { getTranslations } from "next-intl/server";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import type { StorefrontZone } from "@/server/services/storefront";
import { Banknote, Icon, Truck, Undo2 } from "@/components/ui/icons";

/** "Same day", "1–3 days"… from a zone's ETA (null when the seller didn't set one). */
export function etaText(t: (k: string, v?: Record<string, number>) => string, min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  if (hi === 0) return t("etaSameDay");
  if (hi <= 1) return t("etaNextDay");
  if (lo === hi) return t("etaDays", { min: lo, max: hi });
  return t("etaRange", { min: lo, max: hi });
}

/**
 * Delivery promise next to the buy buttons: the seller's home city first (fee + ETA), cash on delivery,
 * the free-delivery threshold, every other city behind a disclosure, and a link to the return policy.
 * Server-rendered: no JS.
 */
export async function DeliveryInfo({
  zones,
  homeCity,
  freeDeliveryThreshold,
  hasReturnPolicy,
  locale,
}: {
  zones: StorefrontZone[];
  homeCity: string | null;
  freeDeliveryThreshold: number | null;
  hasReturnPolicy: boolean;
  locale: Locale;
}) {
  const t = await getTranslations("store");
  const tt = t as unknown as (k: string, v?: Record<string, number>) => string;
  if (!zones.length) return null;
  const home = zones.find((z) => z.key === homeCity) ?? zones[0]!;
  const fee = (n: number) => (n === 0 ? t("free") : formatIQD(n, locale));
  const row = (z: StorefrontZone) => {
    const eta = etaText(tt, z.etaMinDays, z.etaMaxDays);
    return (
      <li key={z.key} className="flex items-baseline justify-between gap-3 py-1.5">
        <span>{pickText(z.name, locale)}</span>
        <span className="text-end text-sm text-muted">
          <span className="num font-medium text-st-fg">{fee(z.fee)}</span>
          {eta && <span> · {eta}</span>}
        </span>
      </li>
    );
  };
  return (
    <section aria-labelledby="delivery-h" className="text-sm">
      <h2 id="delivery-h" className="mb-1 text-[13px] font-medium">{t("deliveryTitle")}</h2>
      <ul className="divide-y divide-st-border">{row(home)}</ul>
      <ul className="mt-2 grid gap-1.5 text-sm text-muted">
        <li className="flex items-center gap-2">
          <Icon as={Banknote} /> {t("codAvailable")}
        </li>
        {freeDeliveryThreshold !== null && (
          <li className="flex items-center gap-2">
            <Icon as={Truck} />
            {t("freeDeliveryOver", { amount: formatIQD(freeDeliveryThreshold, locale) })}
          </li>
        )}
      </ul>
      {zones.length > 1 && (
        <details className="group mt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium underline underline-offset-4">
            {t("allCities", { count: zones.length })}
          </summary>
          <ul className="mt-1 max-h-72 divide-y divide-st-border overflow-y-auto">{zones.filter((z) => z !== home).map(row)}</ul>
        </details>
      )}
      {hasReturnPolicy && (
        <a href="#returns" className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4">
          <Icon as={Undo2} /> {t("returnPolicy")}
        </a>
      )}
    </section>
  );
}
