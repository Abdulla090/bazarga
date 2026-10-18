import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { bestPlan, createAdditionalStore, listAccessibleStores, ownedStoreUsage, resolveCurrentStore } from "@/server/services/store-access";
import { activateRequest, createUpgradeRequest } from "@/server/services/upgrades";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

let k = 0;
const input = () => ({ name: `Extra ${++k}`, slug: `extra-${k}-${Math.random().toString(36).slice(2, 7)}`, defaultLocale: "ku" as const, phone: "9647501234567", whatsapp: "9647501234567", instagram: null, city: "erbil", tagline: {} });
const setPlan = (id: string, plan: string, end: Date | null = null) => database.update(stores).set({ plan, planPeriodEnd: end }).where(eq(stores.id, id));

describe("multiple stores per account (server-side limits)", () => {
  it("Free and Pro: one store only", async () => {
    const s = await seller(database, "ms-free");
    await expect(createAdditionalStore(database, s.user.id, input())).rejects.toThrow("plan_limit_stores");
    await setPlan(s.store.id, "pro");
    await expect(createAdditionalStore(database, s.user.id, input())).rejects.toThrow("plan_limit_stores");
  });

  it("Business: 3 stores, extra stores inherit the plan and period end", async () => {
    const s = await seller(database, "ms-biz");
    const end = new Date(Date.now() + 30 * 864e5);
    await setPlan(s.store.id, "business", end);
    const a = await createAdditionalStore(database, s.user.id, input());
    const b = await createAdditionalStore(database, s.user.id, input());
    expect(a.plan).toBe("business");
    expect(b.planPeriodEnd?.getTime()).toBe(end.getTime());
    await expect(createAdditionalStore(database, s.user.id, input())).rejects.toThrow("plan_limit_stores");
    expect(await ownedStoreUsage(database, s.user.id)).toMatchObject({ used: 3, limit: 3, plan: "business" });
  });

  it("Max: 5 stores", async () => {
    const s = await seller(database, "ms-max");
    await setPlan(s.store.id, "max");
    for (let i = 0; i < 4; i++) await createAdditionalStore(database, s.user.id, input());
    await expect(createAdditionalStore(database, s.user.id, input())).rejects.toThrow("plan_limit_stores");
  });

  it("current store: cookie wins only for a store the user can access", async () => {
    const s = await seller(database, "ms-cur");
    const other = await seller(database, "ms-other");
    await setPlan(s.store.id, "business");
    const extra = await createAdditionalStore(database, s.user.id, input());
    expect((await resolveCurrentStore(database, s.user.id, extra.id))?.store.id).toBe(extra.id);
    expect((await resolveCurrentStore(database, s.user.id, other.store.id))?.store.id).toBe(s.store.id);
    expect((await resolveCurrentStore(database, s.user.id, "garbage"))?.store.id).toBe(s.store.id);
    expect((await listAccessibleStores(database, s.user.id)).map((a) => a.role)).toEqual(["owner", "owner"]);
  });

  it("activating a plan on one store renews the owner's other stores (up to the limit)", async () => {
    const s = await seller(database, "ms-sync");
    await setPlan(s.store.id, "business", new Date(Date.now() + 864e5));
    const extra = await createAdditionalStore(database, s.user.id, input());
    const req = await createUpgradeRequest(database, s.store.id, { plan: "max", months: 1, method: "cash" });
    await activateRequest(database, req.id);
    const [row] = await database.select({ plan: stores.plan }).from(stores).where(eq(stores.id, extra.id));
    expect(row?.plan).toBe("max");
  });

  it("bestPlan picks the highest tier", () => {
    expect(bestPlan(["free", "business", "pro"])).toBe("business");
    expect(bestPlan([])).toBe("free");
  });

  it("the dashboard resolves the store from session + checked cookie, never the client", () => {
    const src = readFileSync("src/server/auth/session.ts", "utf8");
    expect(src).toContain("resolveCurrentStore(db(), user.id, preferred)");
    const act = readFileSync("src/server/actions/stores.ts", "utf8");
    expect(act).toContain("listAccessibleStores(db(), user.id)).some((a) => a.store.id === id.data)");
  });
});
