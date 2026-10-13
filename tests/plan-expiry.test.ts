import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores, storePlanHistory } from "@/server/db/schema";
import { expireLapsedPlans } from "@/server/services/plan-expiry";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("plan expiry", () => {
  it("downgrades lapsed pro stores once and keeps active ones", async () => {
    const a = await seller(database, "exp-a");
    const b = await seller(database, "exp-b");
    await database.update(stores).set({ plan: "pro", planPeriodEnd: new Date(Date.now() - 86400000) }).where(eq(stores.id, a.store.id));
    await database.update(stores).set({ plan: "pro", planPeriodEnd: new Date(Date.now() + 86400000) }).where(eq(stores.id, b.store.id));
    await expireLapsedPlans(database);
    await expireLapsedPlans(database);
    const ra = await database.query.stores.findFirst({ where: eq(stores.id, a.store.id) });
    const rb = await database.query.stores.findFirst({ where: eq(stores.id, b.store.id) });
    expect(ra!.plan).toBe("free");
    expect(rb!.plan).toBe("pro");
    const h = await database.select().from(storePlanHistory).where(eq(storePlanHistory.storeId, a.store.id));
    expect(h).toHaveLength(1);
    expect(h[0]!.reason).toBe("expired");
  });
});
