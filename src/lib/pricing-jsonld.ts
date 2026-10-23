import { PLANS } from "@/lib/plans";

/** schema.org SoftwareApplication with one Offer per plan (USD monthly), for pricing rich results. */
export function pricingJsonLd(name: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: PLANS.map((p) => ({
      "@type": "Offer",
      name: p.id,
      price: p.monthly.toFixed(2),
      priceCurrency: "USD",
      url,
    })),
  };
}
