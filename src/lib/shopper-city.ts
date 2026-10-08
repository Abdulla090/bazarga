/** Remembers the shopper's last checkout city per store so the product page trust row can show their fee. */
export const shopperCityCookie = (slug: string) => `bz_city_${slug}`;

export function pickDeliveryZone<Z extends { key: string }>(zones: Z[], remembered: string | undefined, storeCity: string | null): Z | undefined {
  return (remembered ? zones.find((z) => z.key === remembered) : undefined) ?? zones.find((z) => z.key === storeCity) ?? zones[0];
}
