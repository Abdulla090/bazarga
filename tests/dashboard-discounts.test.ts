import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { createDiscountCode, listDiscountCodes, setDiscountCodeActive, updateDiscountCode } from "@/server/services/discounts";
import { placeOrder } from "@/server/services/orders";
import { discountCodeSchema, iraqDayEndExclusive, iraqDayStart, toIraqDay } from "@/lib/validation";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

const base = { code: "eid20", type: "percentage", value: "20", minSubtotal: "", maxUses: "", startsOn: "", endsOn: "", isActive: true };
const parse = (o: Partial<Record<keyof typeof base, unknown>>) => discountCodeSchema.safeParse({ ...base, ...o });
const issue = (o: Partial<Record<keyof typeof base, unknown>>) => {
  const r = parse(o);
  return r.success ? null : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("discount code form validation", () => {
  it("upper-cases and strips spaces from the code; empty optional fields become null/0", () => {
    const r = discountCodeSchema.parse({ ...base, code: " eid 20 " });
    expect(r).toMatchObject({ code: "EID20", type: "percentage", value: 20, minSubtotal: 0, maxUses: null, startsAt: null, endsAt: null, isActive: true });
  });

  it("rejects bad codes", () => {
    expect(issue({ code: "ab" })).toEqual(["code:invalid_discount_code"]);
    expect(issue({ code: "نەورۆز" })).toEqual(["code:invalid_discount_code"]);
    expect(issue({ code: "X".repeat(33) })).toEqual(["code:invalid_discount_code"]);
  });

  it("percent must be 1–90; fixed is any positive IQD amount", () => {
    expect(issue({ value: "0" })).not.toBeNull();
    expect(issue({ value: "91" })).toEqual(["value:invalid_percent"]);
    expect(issue({ value: "90" })).toBeNull();
    expect(issue({ value: "1" })).toBeNull();
    expect(issue({ type: "fixed", value: "250000" })).toBeNull();
    expect(issue({ type: "fixed", value: "٥٬٠٠٠" })).toBeNull();
    expect(issue({ type: "fixed", value: "0" })).not.toBeNull();
    expect(issue({ type: "free_delivery" })).not.toBeNull();
  });

  it("dates are Iraq calendar days: start inclusive, end inclusive of the whole day; end before start is rejected", () => {
    const r = discountCodeSchema.parse({ ...base, startsOn: "2026-03-20", endsOn: "2026-03-21" });
    expect(r.startsAt!.toISOString()).toBe("2026-03-19T21:00:00.000Z");
    expect(r.endsAt!.toISOString()).toBe("2026-03-21T21:00:00.000Z");
    expect(toIraqDay(r.startsAt)).toBe("2026-03-20");
    expect(toIraqDay(r.endsAt, true)).toBe("2026-03-21");
    expect(issue({ startsOn: "2026-03-21", endsOn: "2026-03-20" })).toEqual(["endsOn:invalid_date_range"]);
    expect(issue({ startsOn: "2026-03-21", endsOn: "2026-03-21" })).toBeNull();
    expect(issue({ startsOn: "2026-02-31" })).toEqual(["startsOn:invalid_date"]);
    expect(issue({ endsOn: "tomorrow" })).toEqual(["endsOn:invalid_date"]);
    expect(iraqDayEndExclusive("2026-03-21").getTime() - iraqDayStart("2026-03-21").getTime()).toBe(86_400_000);
  });

  it("use limit is an optional positive integer", () => {
    expect(issue({ maxUses: "0" })).not.toBeNull();
    expect(discountCodeSchema.parse({ ...base, maxUses: "50" }).maxUses).toBe(50);
  });
});

describe("discount code management (tenant-scoped)", () => {
  it("creates, lists, edits and deactivates codes; a deactivated code no longer applies at checkout", async () => {
    const { store } = await seller(database, "dash-d");
    const created = await createDiscountCode(database, store.id, discountCodeSchema.parse({ ...base, code: "welcome", value: "15" }));
    expect(created).toMatchObject({ code: "WELCOME", type: "percentage", value: 15, usedCount: 0, isActive: true });
    expect((await listDiscountCodes(database, store.id)).map((c) => c.code)).toEqual(["WELCOME"]);

    const edited = await updateDiscountCode(database, store.id, created.id, discountCodeSchema.parse({ ...base, code: "WELCOME", type: "fixed", value: "5000", minSubtotal: "20000", maxUses: "3" }));
    expect(edited).toMatchObject({ type: "fixed", value: 5000, minSubtotal: 20_000, maxUses: 3 });

    const p = await product(database, store.id, 25_000);
    const order = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "welcome" }));
    expect(order.discountAmount).toBe(5_000);

    await setDiscountCodeActive(database, store.id, created.id, false);
    expect((await listDiscountCodes(database, store.id))[0]!.isActive).toBe(false);
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "welcome" }))).rejects.toMatchObject({ message: "discount_inactive" });
  });

  it("codes are unique per store (case-insensitive) but two stores may share one", async () => {
    const a = await seller(database, "dash-u1");
    const b = await seller(database, "dash-u2");
    const first = await createDiscountCode(database, a.store.id, discountCodeSchema.parse({ ...base, code: "NEWROZ" }));
    await expect(createDiscountCode(database, a.store.id, discountCodeSchema.parse({ ...base, code: "newroz" }))).rejects.toMatchObject({ message: "discount_code_taken" });
    await expect(createDiscountCode(database, b.store.id, discountCodeSchema.parse({ ...base, code: "newroz" }))).resolves.toMatchObject({ code: "NEWROZ" });
    const other = await createDiscountCode(database, a.store.id, discountCodeSchema.parse({ ...base, code: "SPRING" }));
    await expect(updateDiscountCode(database, a.store.id, other.id, discountCodeSchema.parse({ ...base, code: "NEWROZ" }))).rejects.toMatchObject({ message: "discount_code_taken" });
    // Saving a code under its own name is not a clash.
    await expect(updateDiscountCode(database, a.store.id, first.id, discountCodeSchema.parse({ ...base, code: "NEWROZ", value: "30" }))).resolves.toMatchObject({ value: 30 });
  });

  it("another store's code id is NOT_FOUND for edit and toggle, and never listed", async () => {
    const a = await seller(database, "dash-t1");
    const b = await seller(database, "dash-t2");
    const theirs = await createDiscountCode(database, a.store.id, discountCodeSchema.parse({ ...base, code: "MINE" }));
    await expect(updateDiscountCode(database, b.store.id, theirs.id, discountCodeSchema.parse({ ...base, code: "HIJACK" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setDiscountCodeActive(database, b.store.id, theirs.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listDiscountCodes(database, b.store.id)).toEqual([]);
    expect((await listDiscountCodes(database, a.store.id))[0]).toMatchObject({ code: "MINE", isActive: true });
  });

  it("edits never reset the use counter", async () => {
    const { store } = await seller(database, "dash-c");
    const c = await createDiscountCode(database, store.id, discountCodeSchema.parse({ ...base, code: "COUNT", value: "10" }));
    const p = await product(database, store.id, 10_000);
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "COUNT" }));
    const after = await updateDiscountCode(database, store.id, c.id, discountCodeSchema.parse({ ...base, code: "COUNT", value: "12" }));
    expect(after.usedCount).toBe(1);
  });
});

describe("discounts screen wiring", () => {
  it("is in the dashboard nav (in the mobile More menu, not the full bottom bar)", () => {
    const nav = readFileSync("src/components/dashboard/DashNav.tsx", "utf8");
    expect(nav).toMatch(/href: "\/dashboard\/discounts", key: "discounts", icon: TicketPercent, mobile: false/);
  });
  it("ku, ar and en have every discounts screen string", async () => {
    for (const l of ["ku", "ar", "en"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Record<string, Record<string, string>>;
      expect(m.dash!.discounts, l).toBeTruthy();
      for (const k of ["title", "code", "percentage", "fixed", "minSubtotal", "maxUses", "startsOn", "endsOn", "active", "uses"]) expect(m.discounts![k], `${l}.${k}`).toBeTruthy();
      for (const k of ["discount_code_taken", "invalid_discount_code", "invalid_percent", "invalid_date", "invalid_date_range"]) expect(m.errors![k], `${l}.${k}`).toBeTruthy();
    }
  });
});
