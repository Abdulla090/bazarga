import { describe, expect, it } from "vitest";
import { waTemplateLink, WA_TEMPLATE_KINDS } from "@/lib/wa-templates";

const o = { storeName: "Hawler & Co", orderNumber: 12, total: 25000, customerPhone: "0750 123 4567", trackingNumber: "TRK-99", trackUrl: "https://x.app/t/1" };
describe("waTemplateLink", () => {
  it("normalises phone and encodes text", () => {
    const u = new URL(waTemplateLink("confirmed", o, "en")!);
    expect(u.pathname).toBe("/9647501234567");
    expect(u.searchParams.get("text")).toContain("Hawler & Co");
    expect(waTemplateLink("confirmed", o, "en")).not.toContain(" ");
  });
  it("handles Arabic-Indic digits", () => {
    expect(waTemplateLink("delivered", { ...o, customerPhone: "٠٧٥٠١٢٣٤٥٦٧" }, "ar")).toContain("wa.me/9647501234567");
  });
  it("shipped includes tracking number and link, in Kurdish", () => {
    const text = new URL(waTemplateLink("shipped", o, "ku")!).searchParams.get("text")!;
    expect(text).toContain("TRK-99");
    expect(text).toContain("https://x.app/t/1");
    expect(text).toContain("نێردرا");
  });
  it("omits tracking when absent; null for bad phone; all locales/kinds work", () => {
    expect(new URL(waTemplateLink("shipped", { ...o, trackingNumber: null }, "en")!).searchParams.get("text")).not.toContain("Tracking number");
    expect(waTemplateLink("confirmed", { ...o, customerPhone: "123" }, "en")).toBeNull();
    for (const l of ["ku", "ar", "en", "kmr"] as const) for (const k of WA_TEMPLATE_KINDS) expect(waTemplateLink(k, o, l)).toMatch(/^https:\/\/wa\.me\/9647501234567\?text=/);
  });
});
