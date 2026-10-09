import { describe, expect, it } from "vitest";
import { QUICK_REPLY_KINDS, quickReplyLink } from "../src/lib/quick-replies";

const o = { storeName: "Shop", orderNumber: 9, total: 25000, customerPhone: "+964 750 123 4567" };
describe("quickReplyLink", () => {
  it("builds a wa.me link per kind and locale", () => {
    for (const l of ["ku", "kmr", "ar", "en"] as const)
      for (const k of QUICK_REPLY_KINDS) {
        const u = quickReplyLink(k, o, l)!;
        expect(u.startsWith("https://wa.me/9647501234567?text=")).toBe(true);
        expect(decodeURIComponent(u)).toContain("#9");
      }
  });
  it("null without phone", () => {
    expect(quickReplyLink("confirmed", { ...o, customerPhone: "" }, "en")).toBeNull();
  });
});
