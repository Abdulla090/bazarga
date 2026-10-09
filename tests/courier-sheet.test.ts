import { describe, expect, it } from "vitest";
import { codAmount, courierDigits, courierOrderText, courierSheetText, type CourierOrder } from "@/lib/courier-sheet";

const base: CourierOrder = { number: 12, customerName: "Aso", customerPhone: "+9647501234567", cityName: "Hawler", address: "Gulan St", total: 45000, paymentMethod: "cod", paymentStatus: "unpaid" };

describe("courier sheet", () => {
  it("collects cash only for unpaid COD", () => {
    expect(codAmount(base)).toBe(45000);
    expect(codAmount({ ...base, paymentStatus: "paid" })).toBe(0);
    expect(codAmount({ ...base, paymentMethod: "fib" })).toBe(0);
  });
  it("builds a text with phone, address and amount", () => {
    const t = courierOrderText({ ...base, landmark: "Near mosque" }, "en");
    expect(t).toContain("Order #12");
    expect(t).toContain("+9647501234567");
    expect(t).toContain("Gulan St");
    expect(t).toContain("Near mosque");
    expect(t).toMatch(/Collect: /);
    expect(courierOrderText({ ...base, paymentStatus: "paid" }, "en")).toContain("Paid");
  });
  it("sums cash across a sheet", () => {
    const t = courierSheetText([base, { ...base, number: 13 }, { ...base, number: 14, paymentStatus: "paid" }], "en");
    expect(t.split("──────").length).toBe(4);
    expect(t.trim().split("\n").pop()).toBe("Collect: 90,000 IQD");
  });
  it("normalizes the courier number", () => {
    expect(courierDigits("0750 123 4567")).toBe("9647501234567");
    expect(courierDigits("")).toBe("");
    expect(courierDigits("123")).toBe("");
  });
});
