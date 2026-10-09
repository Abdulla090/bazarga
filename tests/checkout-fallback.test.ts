import { describe, expect, it } from "vitest";
import { checkoutFallbackLink } from "../src/lib/checkout-fallback";
import { readFileSync } from "node:fs";

const base = { whatsapp: "+964 750 123 4567", storeName: "Shop", lines: [{ name: "Shirt", variantTitle: "L", quantity: 2 }, { name: "Gone", quantity: 1, available: false }], total: 30000, cityName: "Erbil" };
describe("checkoutFallbackLink", () => {
  it("builds a wa.me link in every locale", () => {
    for (const l of ["ku", "kmr", "ar", "en"] as const) {
      const u = checkoutFallbackLink(base, l)!;
      expect(u.startsWith("https://wa.me/9647501234567?text=")).toBe(true);
      const t = decodeURIComponent(u);
      expect(t).toContain("Shirt (L) ×2");
      expect(t).not.toContain("Gone");
      expect(t).toContain("Erbil");
    }
  });
  it("is null without a number or orderable lines", () => {
    expect(checkoutFallbackLink({ ...base, whatsapp: null }, "en")).toBeNull();
    expect(checkoutFallbackLink({ ...base, lines: [{ name: "x", quantity: 1, available: false }] }, "en")).toBeNull();
  });
  it("has the button label in all locales", () => {
    for (const l of ["ku", "kmr", "ar", "en"]) {
      expect(JSON.parse(readFileSync(`messages/${l}.json`, "utf8")).store.orderViaWhatsapp).toBeTruthy();
    }
  });
});
