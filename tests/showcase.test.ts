import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores, users } from "@/server/db/schema";
import { loadShowcaseStores, setShowcaseOptIn } from "@/server/services/showcase";
import { showcaseOptInSchema } from "@/lib/showcase";
import { product, seller, testDb } from "./support/db";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("showcase opt-in schema", () => {
  it("accepts only on/off", () => {
    expect(showcaseOptInSchema.parse({ optIn: "on" }).optIn).toBe(true);
    expect(showcaseOptInSchema.parse({ optIn: "off" }).optIn).toBe(false);
    expect(() => showcaseOptInSchema.parse({ optIn: "yes" })).toThrow();
    expect(() => showcaseOptInSchema.parse({})).toThrow();
  });
});

describe("loadShowcaseStores", () => {
  it("is off by default: a new store never appears until its owner opts in", async () => {
    const { store } = await seller(db, "scdef");
    await product(db, store.id, 5000);
    expect(store.showcaseOptIn).toBe(false);
    expect((await loadShowcaseStores(db)).map((s) => s.slug)).not.toContain(store.slug);
  });

  it("lists an opted-in, active store with products, and drops it on opt-out", async () => {
    const { store } = await seller(db, "scon");
    await product(db, store.id, 5000);
    await product(db, store.id, 7000);
    await setShowcaseOptIn(db, store.id, true);
    const hit = (await loadShowcaseStores(db)).find((s) => s.slug === store.slug);
    expect(hit).toMatchObject({ name: store.name, productCount: 2, city: "erbil", isDemo: false });
    await setShowcaseOptIn(db, store.id, false);
    expect((await loadShowcaseStores(db)).map((s) => s.slug)).not.toContain(store.slug);
  });

  it("hides opted-in stores that have no active product or are deactivated", async () => {
    const empty = await seller(db, "scempty");
    await setShowcaseOptIn(db, empty.store.id, true);
    const off = await seller(db, "scoff");
    await product(db, off.store.id, 5000);
    await setShowcaseOptIn(db, off.store.id, true);
    await db.update(stores).set({ isActive: false }).where(eq(stores.id, off.store.id));
    const slugs = (await loadShowcaseStores(db)).map((s) => s.slug);
    expect(slugs).not.toContain(empty.store.slug);
    expect(slugs).not.toContain(off.store.slug);
  });

  it("flags the seeded demo seller as a demo store and exposes only public fields", async () => {
    const { user, store } = await seller(db, "scdemo");
    await db.update(users).set({ email: "demo@mymarket.app" }).where(eq(users.id, user.id));
    await product(db, store.id, 5000);
    await setShowcaseOptIn(db, store.id, true);
    const hit = (await loadShowcaseStores(db)).find((s) => s.slug === store.slug);
    expect(hit?.isDemo).toBe(true);
    expect(Object.keys(hit!).sort()).toEqual(
      ["city", "coverPlaceholder", "coverRenditions", "coverUrl", "foundingNumber", "isDemo", "logoUrl", "name", "productCount", "slug", "tagline"].sort(),
    );
  });

  it("opt-in changes only the targeted store (tenant isolation)", async () => {
    const a = await seller(db, "scta");
    const b = await seller(db, "sctb");
    await product(db, a.store.id, 5000);
    await product(db, b.store.id, 5000);
    await setShowcaseOptIn(db, a.store.id, true);
    const slugs = (await loadShowcaseStores(db)).map((s) => s.slug);
    expect(slugs).toContain(a.store.slug);
    expect(slugs).not.toContain(b.store.slug);
  });
});
