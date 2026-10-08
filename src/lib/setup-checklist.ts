/**
 * Seller setup checklist (dashboard home). Pure: the service gathers facts from the store's real data
 * (src/server/services/setup.ts) and this decides which steps are done. No step is ever ticked by hand
 * except "delivery fees look right" (the seeded fees may simply be correct) and "link shared" (recorded
 * when the seller copies or shares the link from the dashboard).
 */
import { normalizePhone } from "./phone";

export const SETUP_STEPS = ["logo", "product", "delivery", "whatsapp", "share"] as const;
export type SetupStepKey = (typeof SETUP_STEPS)[number];

export type SetupFacts = {
  logoUrl: string | null;
  activeProductCount: number;
  /** Seller edited delivery: an area exists, or a zone differs from the seeded defaults. */
  deliveryCustomized: boolean;
  deliveryConfirmedAt: Date | null;
  /** Stored as digits ("9647…", legacy) or "+…". */
  whatsapp: string | null;
  linkSharedAt: Date | null;
  orderCount: number;
};

export type SetupStep = { key: SetupStepKey; done: boolean; href: string };
export type SetupChecklist = { steps: SetupStep[]; doneCount: number; total: number; complete: boolean; next: SetupStepKey | null };

const HREF: Record<SetupStepKey, string> = {
  logo: "/dashboard/settings#f-logo",
  product: "/dashboard/products/new",
  delivery: "/dashboard/delivery",
  whatsapp: "/dashboard/settings#f-whatsapp",
  share: "/dashboard",
};

/** A WhatsApp number counts when it is a reachable mobile: Iraqi 07xx or an international number. */
export function hasUsableWhatsapp(stored: string | null | undefined): boolean {
  if (!stored || !stored.trim()) return false;
  const s = stored.trim();
  return normalizePhone(s.startsWith("+") ? s : `+${s}`) !== null;
}

export function buildSetupChecklist(f: SetupFacts): SetupChecklist {
  const done: Record<SetupStepKey, boolean> = {
    logo: !!f.logoUrl,
    product: f.activeProductCount > 0,
    delivery: f.deliveryCustomized || f.deliveryConfirmedAt !== null,
    whatsapp: hasUsableWhatsapp(f.whatsapp),
    // An order means shoppers found the link, even if it was shared from outside the dashboard.
    share: f.linkSharedAt !== null || f.orderCount > 0,
  };
  const steps = SETUP_STEPS.map((key) => ({ key, done: done[key], href: HREF[key] }));
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    next: steps.find((s) => !s.done)?.key ?? null,
  };
}

type ZoneFacts = { cityKey: string; fee: number; isActive: boolean; etaMinDays: number | null; etaMaxDays: number | null };

/**
 * Has the seller touched delivery since signup? New stores get one active zone per governorate at its default fee
 * (src/lib/cities.ts); any area, changed fee, disabled/removed/added zone or delivery estimate counts as edited.
 */
export function isDeliveryCustomized(zones: ZoneFacts[], areaCount: number, defaults: { key: string; fee: number }[]): boolean {
  if (areaCount > 0) return true;
  const byKey = new Map(defaults.map((d) => [d.key, d.fee]));
  if (zones.length !== defaults.length) return true;
  return zones.some(
    (z) => !byKey.has(z.cityKey) || byKey.get(z.cityKey) !== z.fee || !z.isActive || z.etaMinDays !== null || z.etaMaxDays !== null,
  );
}
