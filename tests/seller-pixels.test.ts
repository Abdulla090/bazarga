import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { buildCsp } from "@/server/csp";
import { safePixelId, storePixelsSchema, trackingAllowed, vendorEvent } from "@/lib/pixels";
import { updateStorePixels } from "@/server/services/stores";
import { loadStorefrontStore } from "@/server/services/storefront";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

describe("seller pixel IDs", () => {
  it("accepts TikTok codes and Meta numeric IDs, blank = off, junk is refused", () => {
    expect(storePixelsSchema.parse({ tiktokPixelId: " cabcdef1234567890abc ", metaPixelId: "123456789012345" })).toEqual({ tiktokPixelId: "CABCDEF1234567890ABC", metaPixelId: "123456789012345" });
    expect(storePixelsSchema.parse({ tiktokPixelId: "", metaPixelId: "" })).toEqual({ tiktokPixelId: null, metaPixelId: null });
    for (const bad of ["abc", "'; alert(1)//", "has space 12345", "x".repeat(40)]) expect(storePixelsSchema.safeParse({ tiktokPixelId: bad, metaPixelId: null }).success).toBe(false);
    expect(storePixelsSchema.safeParse({ tiktokPixelId: null, metaPixelId: "12ab34567890" }).success).toBe(false);
    expect(safePixelId("meta", "123456789012345")).toBe("123456789012345");
    expect(safePixelId("meta", "evil()")).toBeNull();
    expect(safePixelId("tiktok", null)).toBeNull();
  });

  it("stores per seller and the storefront loader returns only that store's IDs", async () => {
    const a = await seller(database, "px-a");
    const b = await seller(database, "px-b");
    await updateStorePixels(database, a.store.id, { tiktokPixelId: "CABCDEF1234567890ABC", metaPixelId: "123456789012345" });
    expect(await loadStorefrontStore(database, a.store.slug)).toMatchObject({ tiktokPixelId: "CABCDEF1234567890ABC", metaPixelId: "123456789012345" });
    expect(await loadStorefrontStore(database, b.store.slug)).toMatchObject({ tiktokPixelId: null, metaPixelId: null });
    await updateStorePixels(database, a.store.id, { tiktokPixelId: null, metaPixelId: null });
    const [row] = await database.select({ t: stores.tiktokPixelId, m: stores.metaPixelId }).from(stores).where(eq(stores.id, a.store.id));
    expect(row).toEqual({ t: null, m: null });
  });

  it("respects Do Not Track and Global Privacy Control", () => {
    expect(trackingAllowed({ doNotTrack: null })).toBe(true);
    expect(trackingAllowed({ doNotTrack: "0" })).toBe(true);
    expect(trackingAllowed({ doNotTrack: "1" })).toBe(false);
    expect(trackingAllowed({ doNotTrack: null, globalPrivacyControl: true })).toBe(false);
    expect(trackingAllowed(undefined)).toBe(false);
  });

  it("maps events to vendor names with no personal data", () => {
    const d = { value: 45000, ids: ["p1"], name: "Bag" };
    expect(vendorEvent("meta", "Purchase", d)).toEqual({ name: "Purchase", params: { content_type: "product", currency: "IQD", value: 45000, content_ids: ["p1"], content_name: "Bag" } });
    const tt = vendorEvent("tiktok", "Purchase", d);
    expect(tt.name).toBe("CompletePayment");
    expect(JSON.stringify(tt.params)).not.toMatch(/phone|address|email/);
    expect(vendorEvent("tiktok", "AddToCart").name).toBe("AddToCart");
    expect(vendorEvent("meta", "ViewContent").name).toBe("ViewContent");
  });

  it("CSP lets only storefront pages talk to the pixel hosts", () => {
    const shop = buildCsp({ nonce: "n", isDev: false, storefront: true });
    const dash = buildCsp({ nonce: "n", isDev: false });
    expect(shop).toContain("https://analytics.tiktok.com");
    expect(shop).toContain("https://www.facebook.com");
    expect(dash).toContain("connect-src 'self'");
    expect(dash).not.toContain("tiktok");
    expect(shop.split("; ").find((x) => x.startsWith("script-src"))).not.toContain("unsafe-inline");
  });
});
