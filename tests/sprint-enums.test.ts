import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  LEGACY_ORDER_STATUS,
  LOST_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  RESTOCK_ON,
  TERMINAL_ORDER_STATUSES,
  canTransition,
  isOrderStatus,
} from "@/lib/order-status";
import { DISCOUNT_TYPES, applyDiscount, checkDiscount, isDiscountType, normalizeDiscountCode, DISCOUNT_CODE_RE, type DiscountRule } from "@/lib/discounts";
import { GOVERNORATE_KEYS, IRAQ_GOVERNORATES, governorateForCityKey, isGovernorateKey } from "@/lib/governorates";
import { IRAQI_CITIES } from "@/lib/cities";
import { PRESET_TOKENS, THEME_PRESETS, contrastRatio, readableOn, resolveTheme, themeStyle } from "@/lib/theme";
import { discountTypeEnum, orderStatusEnum, pushAudienceEnum, stores, themePresetEnum } from "@/server/db/schema";

describe("order status enum (COD lifecycle)", () => {
  it("TS list and DB enum are identical", () => {
    expect(orderStatusEnum.enumValues).toEqual([...ORDER_STATUSES]);
    expect(ORDER_STATUSES).toEqual(["pending", "confirmed", "shipped", "delivered", "postponed", "refused", "returned", "cancelled"]);
  });
  it("every status has a transition entry, targets are valid, no self-loops", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[s]).toBeDefined();
      for (const t of ORDER_TRANSITIONS[s]) {
        expect(isOrderStatus(t)).toBe(true);
        expect(t).not.toBe(s);
      }
    }
  });
  it("every status is reachable from pending", () => {
    const seen = new Set(["pending"]);
    const q = ["pending" as const as (typeof ORDER_STATUSES)[number]];
    while (q.length) {
      for (const n of ORDER_TRANSITIONS[q.shift()!]) {
        if (seen.has(n)) continue;
        seen.add(n);
        q.push(n);
      }
    }
    expect([...seen].sort()).toEqual([...ORDER_STATUSES].sort());
  });
  it("encodes the COD rules", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("pending", "delivered")).toBe(false);
    expect(canTransition("shipped", "refused")).toBe(true);
    expect(canTransition("refused", "returned")).toBe(true);
    expect(canTransition("refused", "delivered")).toBe(false);
    expect(canTransition("postponed", "shipped")).toBe(true);
    expect(canTransition("delivered", "returned")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false); // goods are out — refuse/return instead
    expect(TERMINAL_ORDER_STATUSES).toEqual(["returned", "cancelled"]);
  });
  it("open/lost/restock sets are consistent", () => {
    for (const s of OPEN_ORDER_STATUSES) expect(LOST_ORDER_STATUSES).not.toContain(s);
    expect(RESTOCK_ON).toEqual(["cancelled", "returned"]);
    expect(RESTOCK_ON).not.toContain("refused");
    expect(Object.values(LEGACY_ORDER_STATUS).every(isOrderStatus)).toBe(true);
    expect(isOrderStatus("new")).toBe(false);
  });
});

describe("other enums mirror their TS sources", () => {
  it("discount_type, theme_preset, push_audience", () => {
    expect(discountTypeEnum.enumValues).toEqual([...DISCOUNT_TYPES]);
    expect(themePresetEnum.enumValues).toEqual([...THEME_PRESETS]);
    expect(pushAudienceEnum.enumValues).toEqual(["seller", "customer"]);
    expect(isDiscountType("percentage")).toBe(true);
    expect(isDiscountType("bogo")).toBe(false);
  });
  it("stores table carries the theme fields", () => {
    const cols = getTableConfig(stores).columns.map((c) => c.name);
    for (const c of ["theme_preset", "accent_color", "cover_image_url", "about", "return_policy", "free_delivery_threshold"]) {
      expect(cols).toContain(c);
    }
  });
});

describe("discount codes", () => {
  const rule = (o: Partial<DiscountRule> = {}): DiscountRule => ({
    type: "percentage",
    value: 10,
    minSubtotal: 0,
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...o,
  });
  const now = new Date("2026-03-21T12:00:00Z");

  it("normalises codes", () => {
    expect(normalizeDiscountCode("  newroz 26 ")).toBe("NEWROZ26");
    expect(DISCOUNT_CODE_RE.test("NEWROZ26")).toBe(true);
    expect(DISCOUNT_CODE_RE.test("نەورۆز")).toBe(false);
  });
  it("percentage rounds down to whole dinars", () => {
    expect(applyDiscount({ subtotal: 33_333, deliveryFee: 3000, freeDeliveryThreshold: null, discount: rule() }, now)).toEqual({
      discountAmount: 3333,
      deliveryFee: 3000,
      freeDelivery: false,
      total: 33_000,
      rejection: null,
    });
  });
  it("fixed never exceeds the subtotal", () => {
    const r = applyDiscount({ subtotal: 5000, deliveryFee: 3000, freeDeliveryThreshold: null, discount: rule({ type: "fixed", value: 9000 }) }, now);
    expect(r.discountAmount).toBe(5000);
    expect(r.total).toBe(3000);
  });
  it("free_delivery code zeroes the fee", () => {
    const r = applyDiscount({ subtotal: 20_000, deliveryFee: 5000, freeDeliveryThreshold: null, discount: rule({ type: "free_delivery", value: 0 }) }, now);
    expect(r).toMatchObject({ discountAmount: 0, deliveryFee: 0, freeDelivery: true, total: 20_000 });
  });
  it("free-delivery threshold uses the pre-discount subtotal", () => {
    const r = applyDiscount({ subtotal: 50_000, deliveryFee: 5000, freeDeliveryThreshold: 50_000, discount: rule() }, now);
    expect(r).toMatchObject({ discountAmount: 5000, deliveryFee: 0, total: 45_000 });
    const below = applyDiscount({ subtotal: 49_999, deliveryFee: 5000, freeDeliveryThreshold: 50_000, discount: null }, now);
    expect(below.deliveryFee).toBe(5000);
  });
  it("rejections leave the price untouched", () => {
    const cases: [Partial<DiscountRule>, string][] = [
      [{ isActive: false }, "inactive"],
      [{ startsAt: new Date("2026-04-01") }, "not_started"],
      [{ endsAt: now }, "expired"],
      [{ maxUses: 5, usedCount: 5 }, "used_up"],
      [{ minSubtotal: 100_000 }, "below_minimum"],
    ];
    for (const [o, why] of cases) {
      expect(checkDiscount(rule(o), 10_000, now)).toBe(why);
      const r = applyDiscount({ subtotal: 10_000, deliveryFee: 3000, freeDeliveryThreshold: null, discount: rule(o) }, now);
      expect(r).toMatchObject({ rejection: why, discountAmount: 0, total: 13_000 });
    }
  });
  it("rejects invalid money", () => {
    expect(() => applyDiscount({ subtotal: -1, deliveryFee: 0, freeDeliveryThreshold: null, discount: null })).toThrow();
    expect(() => applyDiscount({ subtotal: 1.5, deliveryFee: 0, freeDeliveryThreshold: null, discount: null })).toThrow();
    expect(() => applyDiscount({ subtotal: 1000, deliveryFee: 0, freeDeliveryThreshold: null, discount: rule({ value: 0 }) })).toThrow();
  });
});

describe("governorates", () => {
  it("has 19 unique keys (18 + Halabja), Kurdistan first, all four languages", () => {
    expect(GOVERNORATE_KEYS.length).toBe(19);
    expect(new Set(GOVERNORATE_KEYS).size).toBe(19);
    expect(IRAQ_GOVERNORATES.slice(0, 4).every((g) => g.region === "kurdistan")).toBe(true);
    for (const g of IRAQ_GOVERNORATES) for (const l of ["ku", "ar", "en", "kmr"] as const) expect(g.name[l]).toBeTruthy();
  });
  it("maps legacy city keys", () => {
    expect(governorateForCityKey("mosul")).toBe("ninawa");
    expect(governorateForCityKey("zakho")).toBe("duhok");
    expect(governorateForCityKey("erbil")).toBe("erbil");
    expect(governorateForCityKey("ranya")).toBeNull();
    expect(isGovernorateKey("baghdad")).toBe(true);
  });
  it("new stores are seeded one zone per governorate", () => {
    expect(IRAQI_CITIES.map((c) => c.key)).toEqual([...GOVERNORATE_KEYS]);
  });
});

describe("theme presets", () => {
  it("three presets with readable text", () => {
    expect(THEME_PRESETS.length).toBe(3);
    for (const p of THEME_PRESETS) {
      const t = PRESET_TOKENS[p];
      expect(contrastRatio(t.fg, t.bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.onHero, t.hero)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("accent override picks a contrasting text colour; junk falls back", () => {
    expect(readableOn("#F5B700")).toBe("#0A0A0B");
    expect(readableOn("#1A7A50")).toBe("#FFFFFF");
    expect(resolveTheme("mountain", "#C2185B")).toMatchObject({ accent: "#C2185B", onAccent: "#FFFFFF" });
    expect(resolveTheme("nope", "red")).toEqual(PRESET_TOKENS.bazaar);
    expect(themeStyle(PRESET_TOKENS.night)["--st-accent"]).toBe("#60A5FA");
  });
});
