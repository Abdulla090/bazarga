import { describe, expect, it } from "vitest";
import { freeDeliveryPercent } from "@/components/store/CartCheckout";

describe("freeDeliveryPercent", () => {
  it("computes progress", () => {
    expect(freeDeliveryPercent(12000, 8000)).toBe(60);
    expect(freeDeliveryPercent(0, 20000)).toBe(0);
    expect(freeDeliveryPercent(0, 0)).toBe(100);
  });
});
