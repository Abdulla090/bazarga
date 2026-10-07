import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { updateStoreStorefront } from "@/server/services/stores";
import { parseIqdInput, storeStorefrontSchema } from "@/lib/validation";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

const PH = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

describe("storeStorefrontSchema", () => {
  it("parses IQD amounts in any digits and empties to null", () => {
    expect(parseIqdInput("50,000")).toBe(50000);
    expect(parseIqdInput("٥٠٬٠٠٠")).toBe(50000);
    expect(parseIqdInput("۵۰۰۰۰ IQD")).toBe(50000);
    expect(parseIqdInput("")).toBeNull();
    expect(parseIqdInput("  ")).toBeNull();
    expect(Number.isNaN(parseIqdInput("12.5"))).toBe(true);
  });
  it("accepts a valid cover + threshold", () => {
    const v = storeStorefrontSchema.parse({ coverImageUrl: "/uploads/a.webp", coverImagePlaceholder: PH, freeDeliveryThreshold: "75,000" });
    expect(v).toEqual({ coverImageUrl: "/uploads/a.webp", coverImagePlaceholder: PH, freeDeliveryThreshold: 75000 });
  });
  it("empty fields mean no cover / no threshold; bad placeholder is dropped", () => {
    expect(storeStorefrontSchema.parse({ coverImageUrl: "", coverImagePlaceholder: "javascript:x", freeDeliveryThreshold: "" })).toEqual({
      coverImageUrl: null,
      coverImagePlaceholder: null,
      freeDeliveryThreshold: null,
    });
  });
  it.each([["0"], ["-5"], ["abc"], ["100000001"], ["1.5"]])("rejects threshold %s", (v) => {
    const r = storeStorefrontSchema.safeParse({ coverImageUrl: "", freeDeliveryThreshold: v });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["freeDeliveryThreshold"]);
  });
  it.each([["//evil.com/x.png"], ["http://x.com/a.png"], ["javascript:alert(1)"]])("rejects cover url %s", (u) => {
    expect(storeStorefrontSchema.safeParse({ coverImageUrl: u, freeDeliveryThreshold: "" }).success).toBe(false);
  });
});

describe("updateStoreStorefront", () => {
  it("saves cover, placeholder and threshold", async () => {
    const { store } = await seller(database, "cov");
    const s = await updateStoreStorefront(database, store.id, { coverImageUrl: "https://cdn.example.com/c.webp", coverImagePlaceholder: PH, freeDeliveryThreshold: 50000 });
    expect(s.coverImageUrl).toBe("https://cdn.example.com/c.webp");
    expect(s.coverImagePlaceholder).toBe(PH);
    expect(s.freeDeliveryThreshold).toBe(50000);
  });
  it("removing the cover clears placeholder and key; null threshold turns it off", async () => {
    const { store } = await seller(database, "cov2");
    await database.update(stores).set({ coverImageUrl: "/x.webp", coverImageKey: "k/x.webp", coverImagePlaceholder: PH, freeDeliveryThreshold: 10 }).where(eq(stores.id, store.id));
    const s = await updateStoreStorefront(database, store.id, { coverImageUrl: null, coverImagePlaceholder: PH, freeDeliveryThreshold: null });
    expect(s.coverImageUrl).toBeNull();
    expect(s.coverImagePlaceholder).toBeNull();
    expect(s.coverImageKey).toBeNull();
    expect(s.freeDeliveryThreshold).toBeNull();
  });
  it("only touches the given store", async () => {
    const a = await seller(database, "iso-a");
    const b = await seller(database, "iso-b");
    await updateStoreStorefront(database, a.store.id, { coverImageUrl: "/a.webp", coverImagePlaceholder: null, freeDeliveryThreshold: 1000 });
    const other = await database.query.stores.findFirst({ where: eq(stores.id, b.store.id) });
    expect(other?.coverImageUrl).toBeNull();
    expect(other?.freeDeliveryThreshold).toBeNull();
  });
  it("throws NOT_FOUND for an unknown store", async () => {
    await expect(
      updateStoreStorefront(database, "00000000-0000-0000-0000-000000000000", { coverImageUrl: null, coverImagePlaceholder: null, freeDeliveryThreshold: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
