import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  COMPARE, MAX_MONTHLY_USD, STORE_LIMIT, TEAM_LIMIT, PAID_PLAN_IDS, PLANS, PLAN_IDS, PRODUCT_CAP, getPlan, isPaidPlan, normalizePlan, productLimit, productsShown,
  showsBazargaBadge, studioEditsLimit, usd, yearlyMonthsFree,
} from "../src/lib/plans";

const LOCALES = ["en", "ku", "kmr", "ar"] as const;
const msgs = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));

describe("plans config (pricing v2, 2026-10-14)", () => {
  it("has the agreed round USD prices; yearly is 2 months free", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "pro", "business", "max"]);
    expect(getPlan("free")).toMatchObject({ monthly: 0, yearly: 0 });
    expect(getPlan("pro")).toMatchObject({ monthly: 15, yearly: 150, firstMonth: 1 });
    expect(getPlan("business")).toMatchObject({ monthly: 50, yearly: 500 });
    expect(getPlan("max")).toMatchObject({ monthly: MAX_MONTHLY_USD, yearly: MAX_MONTHLY_USD * 10 });
    expect(MAX_MONTHLY_USD).toBe(100);
    for (const p of PLANS) {
      expect(Number.isInteger(p.monthly) && Number.isInteger(p.yearly)).toBe(true);
      expect(String(p.monthly)).not.toMatch(/9$/); // never .99-style prices
      if (p.monthly) expect(yearlyMonthsFree(p)).toBe(2);
    }
    expect(usd(15)).toBe("$15");
  });

  it("product caps: 10 / 100 / hidden 1000 / hidden 10000; unlimited plans show no number", () => {
    expect(PRODUCT_CAP).toEqual({ free: 10, pro: 100, business: 1000, max: 10000 });
    expect(PLAN_IDS.map(productLimit)).toEqual([10, 100, 1000, 10000]);
    expect(PLAN_IDS.map(productsShown)).toEqual([10, 100, null, null]);
  });

  it("Product Studio quota: 0 / 10 / 100 / 100 edits a month", () => {
    expect(PLAN_IDS.map(studioEditsLimit)).toEqual([0, 10, 100, 100]);
  });

  it("normalizePlan / isPaidPlan accept max, everything unknown is free", () => {
    expect(normalizePlan("max")).toBe("max");
    expect(normalizePlan("business")).toBe("business");
    expect(normalizePlan("enterprise")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(PAID_PLAN_IDS).toEqual(["pro", "business", "max"]);
    expect(isPaidPlan("max")).toBe(true);
    expect(isPaidPlan("free")).toBe(false);
  });

  it("Business is the popular card, Max the premium one; tiers are cumulative", () => {
    expect(PLANS.filter((p) => p.highlight).map((p) => p.id)).toEqual(["business"]);
    expect(PLANS.filter((p) => p.premium).map((p) => p.id)).toEqual(["max"]);
    expect(PLANS.map((p) => p.includes)).toEqual([undefined, "free", "pro", "business"]);
    expect(showsBazargaBadge("free")).toBe(true);
    for (const p of ["pro", "business", "max"] as const) expect(showsBazargaBadge(p)).toBe(false);
  });

  it("margin pass: no API, account manager, Instagram import or WhatsApp cart reminders; Max is 5 stores / 10 seats", () => {
    const gone = ["api", "accountManager", "igImport", "abandonedCart", "teamUnlimited", "stores10"];
    for (const p of PLANS) for (const f of p.features) expect(gone).not.toContain(f.key);
    for (const r of COMPARE) expect(["api", "igImport", "abandonedCart"]).not.toContain(r.key);
    for (const r of COMPARE) for (const id of PLAN_IDS) {
      const c = r[id];
      expect(typeof c === "object" ? c.v : c).not.toBe("manager");
    }
    expect(STORE_LIMIT).toEqual({ free: 1, pro: 1, business: 3, max: 5 });
    expect(TEAM_LIMIT).toEqual({ free: 0, pro: 2, business: 5, max: 10 });
    // Card feature keys carry the same numbers as the limits.
    for (const p of PLANS) for (const f of p.features) {
      const m = f.key.match(/^(stores|team)(\d+)$/);
      if (m) expect(Number(m[2])).toBe(m[1] === "stores" ? STORE_LIMIT[p.id] : TEAM_LIMIT[p.id]);
    }
    const maxKeys = getPlan("max").features.map((f) => f.key);
    for (const k of ["aiDesigner", "exclusiveDesigns", "whiteLabel", "earlyAccess", "priorityStudio", "templatesPremium", "seoAdvanced", "designRefresh", "stores5", "team10"]) {
      expect(maxKeys).toContain(k);
    }
    for (const k of ["priorityStudio", "designRefresh"]) expect(getPlan("max").features.find((f) => f.key === k)?.soon).toBe(true);
    const r = (k: string) => COMPARE.find((x) => x.key === k)!;
    expect(r("stores").max).toBe(5);
    expect(r("team").max).toBe(10);
    for (const l of LOCALES) {
      const copy = JSON.stringify(msgs(l).pricing);
      expect(copy).not.toMatch(/API access|account manager|Instagram product import|abandoned-cart|Unlimited team/i);
    }
  });

  it("the hidden caps never appear in any copy, card or table", () => {
    for (const r of COMPARE) for (const id of PLAN_IDS) {
      const c = r[id];
      const v = typeof c === "object" ? c.v : c;
      expect(v === 1000 || v === 10000).toBe(false);
    }
    for (const l of LOCALES) {
      const copy = JSON.stringify({ pricing: msgs(l).pricing, faq: msgs(l).landing.faq, errors: msgs(l).errors });
      expect(copy).not.toMatch(/(?<!\$)\b10?[,.]?000\b/);
    }
  });

  it("every feature, row and cell key exists in all 4 locales; no Eastern-Arabic digits; counts come from config", () => {
    for (const loc of LOCALES) {
      const m = msgs(loc).pricing;
      for (const k of ["max", "maxDesc", "ctaMax", "everything", "soon", "premium", "planChip", "usageProducts", "usageProductsUnlimited", "upgradeCta", "limitHint"]) {
        expect(m[k], `${loc}.pricing.${k}`).toBeTruthy();
      }
      for (const p of PLANS) {
        expect(m[p.id]).toBeTruthy();
        expect(m[`${p.id}Desc`]).toBeTruthy();
        for (const f of p.features) expect(m.features[f.key], `${loc} features.${f.key}`).toBeTruthy();
      }
      expect(m.features.products).toContain("{count}");
      expect(m.features.studio).toContain("{count}");
      for (const r of COMPARE) {
        expect(m.rows[r.key], `${loc} rows.${r.key}`).toBeTruthy();
        for (const id of PLAN_IDS) {
          const c = r[id];
          const v = typeof c === "object" ? c.v : c;
          if (typeof v === "string") expect(m.cells[v], `${loc} cells.${v}`).toBeTruthy();
        }
      }
      for (const k of ["q1", "q2", "q3", "q4", "q5"]) expect(m.faq[k].a).toBeTruthy();
      expect(JSON.stringify(m)).not.toMatch(/[٠-٩]/);
      expect(msgs(loc).upgrade.name.max).toBe("Max");
      expect(msgs(loc).errors.plan_limit_products).toBeTruthy();
      expect(msgs(loc).errors.plan_limit_studio).toBeTruthy();
    }
  });

  it("all 4 locale files have exactly the same pricing keys", () => {
    const keys = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`])).sort();
    const en = keys(msgs("en").pricing);
    for (const l of ["ku", "kmr", "ar"]) expect(keys(msgs(l).pricing)).toEqual(en);
  });

  it("no old prices ($10 Pro, $20 Business, $100/$200 yearly, 15 products) are left in copy", () => {
    for (const l of LOCALES) {
      const p = msgs(l).pricing;
      const all = JSON.stringify({ pricing: p, faq: msgs(l).landing.faq });
      expect(all).not.toMatch(/\$10(?!\d)|\$20(?!\d)|\$200(?!\d)/);
      expect(all).not.toMatch(/\b15 (products|بەرهەم|berhem|منتج)/);
      // $100 only ever appears as the Max price, which lives in config, not copy.
      expect(all).not.toMatch(/\$100(?!\d)/);
      expect(p.after).toContain("$15");
      expect(p.wasNow).toContain("$15");
    }
  });
});

describe("pro promo", () => {
  it("first month is $1, cheaper than a regular month, and only Pro has a promo", async () => {
    const { PRO_FIRST_MONTH, PLANS, getPlan } = await import("../src/lib/plans");
    expect(PRO_FIRST_MONTH).toBe(1);
    expect(getPlan("pro").firstMonth).toBe(PRO_FIRST_MONTH);
    expect(getPlan("pro").firstMonth!).toBeLessThan(getPlan("pro").monthly);
    expect(PLANS.filter((p) => p.firstMonth !== undefined).map((p) => p.id)).toEqual(["pro"]);
  });
});
