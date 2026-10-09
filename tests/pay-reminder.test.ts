import { describe, expect, it } from "vitest";
import { payReminderLink } from "../src/lib/pay-reminder";

const o = { storeName: "Shop", orderNumber: 7, total: 25000, customerPhone: "+964 750 123 4567", payUrl: "https://x.test/pay/7" };
describe("payReminderLink", () => {
  it("builds a wa.me link in every locale", () => {
    for (const l of ["ku", "kmr", "ar", "en"] as const) {
      const u = payReminderLink(o, l)!;
      expect(u.startsWith("https://wa.me/9647501234567?text=")).toBe(true);
      expect(decodeURIComponent(u)).toContain("#7");
      expect(decodeURIComponent(u)).toContain("https://x.test/pay/7");
    }
  });
  it("returns null without a phone", () => {
    expect(payReminderLink({ ...o, customerPhone: "" }, "en")).toBeNull();
  });
});
