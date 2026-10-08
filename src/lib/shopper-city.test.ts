import { describe, expect, it } from "vitest";
import { pickDeliveryZone, shopperCityCookie } from "./shopper-city";

const zones = [{ key: "erbil" }, { key: "duhok" }, { key: "sulaymaniyah" }];
describe("pickDeliveryZone", () => {
  it("prefers the remembered city", () => expect(pickDeliveryZone(zones, "duhok", "erbil")?.key).toBe("duhok"));
  it("falls back to store city when unknown or missing", () => {
    expect(pickDeliveryZone(zones, "mosul", "sulaymaniyah")?.key).toBe("sulaymaniyah");
    expect(pickDeliveryZone(zones, undefined, "erbil")?.key).toBe("erbil");
  });
  it("falls back to first zone", () => expect(pickDeliveryZone(zones, undefined, "x")?.key).toBe("erbil"));
  it("scopes cookie per store", () => expect(shopperCityCookie("a")).not.toBe(shopperCityCookie("b")));
});
