import { describe, expect, it } from "vitest";
import { pricingJsonLd } from "@/lib/pricing-jsonld";
import { PLANS } from "@/lib/plans";

describe("pricingJsonLd", () => {
  it("has one USD offer per plan", () => {
    const j = pricingJsonLd("Reelcart", "https://x.test/pricing");
    expect(j.offers).toHaveLength(PLANS.length);
    expect(j.offers[0].price).toBe("0.00");
    expect(j.offers.every((o) => o.priceCurrency === "USD")).toBe(true);
  });
});
