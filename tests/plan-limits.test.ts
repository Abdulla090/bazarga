import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { assertWithinProductLimit } from "@/server/services/catalog";
import { AppError } from "@/server/errors";
import { product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("plan limits", () => {
  it("free stores are capped at 15 products; pro is unlimited", async () => {
    const { store } = await seller(database, "plan-lim");
    for (let i = 0; i < 15; i++) await product(database, store.id, 1000);
    await expect(assertWithinProductLimit(database, store.id)).rejects.toBeInstanceOf(AppError);
    await database.update(stores).set({ plan: "pro" }).where(eq(stores.id, store.id));
    await expect(assertWithinProductLimit(database, store.id)).resolves.toBeUndefined();
  });
  it("defaults to free", async () => {
    const { store } = await seller(database, "plan-def");
    const row = await database.query.stores.findFirst({ where: eq(stores.id, store.id) });
    expect(row!.plan).toBe("free");
  });
});
