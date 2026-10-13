import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores, storePlanHistory } from "@/server/db/schema";
import { activateRequest, addMonths, createUpgradeRequest, listRequests, rejectRequest } from "@/server/services/upgrades";
import { isAdminEmail } from "@/server/auth/admin";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

describe("upgrade requests", () => {
  it("validates input and keeps one pending request per store", async () => {
    const s = await seller(database, "up1");
    await expect(createUpgradeRequest(database, s.store.id, { plan: "free", months: 1, method: "fib" })).rejects.toThrow();
    await createUpgradeRequest(database, s.store.id, { plan: "pro", months: 1, method: "fib" });
    await createUpgradeRequest(database, s.store.id, { plan: "business", months: 12, method: "cash" });
    const rows = (await listRequests(database)).filter((r) => r.r.storeId === s.store.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.r.plan).toBe("business");
  });
  it("activates once, sets plan + period end + history", async () => {
    const s = await seller(database, "up2");
    const r = await createUpgradeRequest(database, s.store.id, { plan: "pro", months: 12, method: "zaincash" });
    const now = new Date("2026-10-14T10:00:00Z");
    const a = await activateRequest(database, r.id, now);
    const b = await activateRequest(database, r.id, now);
    expect(a.already).toBe(false);
    expect(b.already).toBe(true);
    const st = await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) });
    expect(st!.plan).toBe("pro");
    expect(st!.planPeriodEnd!.toISOString()).toBe("2027-10-14T10:00:00.000Z");
    const h = await database.select().from(storePlanHistory).where(eq(storePlanHistory.storeId, s.store.id));
    expect(h).toHaveLength(1);
    expect(h[0]!.reason).toBe("upgrade:zaincash");
  });
  it("extends an active plan and supports reject", async () => {
    const s = await seller(database, "up3");
    const now = new Date("2026-10-14T00:00:00Z");
    const r1 = await createUpgradeRequest(database, s.store.id, { plan: "pro", months: 1, method: "cash" });
    await activateRequest(database, r1.id, now);
    const r2 = await createUpgradeRequest(database, s.store.id, { plan: "pro", months: 1, method: "cash" });
    await activateRequest(database, r2.id, now);
    const st = await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) });
    expect(st!.planPeriodEnd!.toISOString().slice(0, 10)).toBe("2026-12-14");
    const r3 = await createUpgradeRequest(database, s.store.id, { plan: "pro", months: 1, method: "fib" });
    await rejectRequest(database, r3.id);
    await expect(activateRequest(database, r3.id)).resolves.toEqual({ already: true });
  });
  it("addMonths clamps month end; admin allowlist", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(isAdminEmail("A@x.com", "a@x.com, b@y.com")).toBe(true);
    expect(isAdminEmail("c@x.com", "a@x.com")).toBe(false);
    expect(isAdminEmail("a@x.com", "")).toBe(false);
  });
});
