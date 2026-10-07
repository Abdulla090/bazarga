import type { LocalizedText } from "./i18n";
import { IRAQ_GOVERNORATES } from "./governorates";

export type CitySeed = { key: string; governorateKey: string; name: LocalizedText; fee: number };

/**
 * Default delivery zones seeded for every new store: one per governorate (fees in IQD, editable per store).
 * Sellers add finer-grained `delivery_areas` (neighbourhoods/towns) under a zone.
 */
export const IRAQI_CITIES: CitySeed[] = IRAQ_GOVERNORATES.map((g) => ({
  key: g.key,
  governorateKey: g.key,
  name: g.name,
  fee: g.defaultFee,
}));
