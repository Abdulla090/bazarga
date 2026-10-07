import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { deliveryAreas, deliveryZones, orders } from "@/server/db/schema";
import { addArea, deleteArea, listAreas, updateArea } from "@/server/services/settings";
import { loadStorefrontSettings } from "@/server/services/storefront";
import { placeOrder, quoteCart } from "@/server/services/orders";
import { deliveryAreaSchema } from "@/lib/validation";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});
const zoneOf = async (storeId: string, cityKey = "erbil") =>
  (await database.query.deliveryZones.findFirst({ where: and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.cityKey, cityKey)) }))!;

describe("delivery area form validation", () => {
  it("needs a name in some language; empty fee = city fee (null); fee must be whole IQD ≥ 0", () => {
    expect(deliveryAreaSchema.parse({ name: { ku: " عەنکاوە ", en: "" }, fee: "" })).toEqual({ name: { ku: "عەنکاوە" }, fee: null });
    expect(deliveryAreaSchema.parse({ name: { en: "Ankawa" }, fee: "٢٬٠٠٠" }).fee).toBe(2_000);
    expect(deliveryAreaSchema.parse({ name: { en: "Free" }, fee: "0" }).fee).toBe(0);
    expect(deliveryAreaSchema.safeParse({ name: { ku: "", en: "" }, fee: "" }).success).toBe(false);
    expect(deliveryAreaSchema.safeParse({ name: { en: "x" }, fee: "-5" }).success).toBe(false);
    expect(deliveryAreaSchema.safeParse({ name: { en: "x" }, fee: "abc" }).success).toBe(false);
  });
});

describe("delivery areas per city (tenant-scoped)", () => {
  it("add → shows in the storefront settings and checkout; rename keeps other translations; fee override → back to city fee; remove", async () => {
    const { store } = await seller(database, "areas");
    const zone = await zoneOf(store.id);
    const area = await addArea(database, store.id, zone.id, { name: { ku: "عەنکاوە", en: "Ankawa", kmr: "Enkawa" }, fee: 1_500 });
    expect((await listAreas(database, store.id)).map((a) => a.id)).toEqual([area.id]);

    let settings = await loadStorefrontSettings(database, store.id);
    expect(settings.zones.find((z) => z.key === "erbil")!.areas).toEqual([{ id: area.id, name: area.name, fee: 1_500 }]);
    const p = await product(database, store.id, 10_000);
    expect((await quoteCart(database, store.id, [{ productId: p.id, quantity: 1 }], "erbil", "en", { areaId: area.id })).deliveryFee).toBe(1_500);

    // Dashboard edits ku/ar/en: kmr survives the rename. Clearing the fee falls back to the city's fee.
    const renamed = await updateArea(database, store.id, area.id, { name: { ku: "عەنکاوەی نوێ", en: "New Ankawa" }, fee: null }, ["ku", "ar", "en"]);
    expect(renamed.name).toEqual({ ku: "عەنکاوەی نوێ", en: "New Ankawa", kmr: "Enkawa" });
    settings = await loadStorefrontSettings(database, store.id);
    expect(settings.zones.find((z) => z.key === "erbil")!.areas[0]).toMatchObject({ fee: zone.fee });
    const order = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { areaId: area.id, locale: "en" }));
    expect(order).toMatchObject({ areaName: "New Ankawa", deliveryFee: zone.fee });

    await deleteArea(database, store.id, area.id);
    expect(await listAreas(database, store.id)).toEqual([]);
    settings = await loadStorefrontSettings(database, store.id);
    expect(settings.zones.find((z) => z.key === "erbil")!.areas).toEqual([]);
    // The past order keeps its area name; the link is cleared by the FK.
    const kept = await database.query.orders.findFirst({ where: eq(orders.id, order.id) });
    expect(kept).toMatchObject({ areaId: null, areaName: "New Ankawa" });
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { areaId: area.id }))).rejects.toMatchObject({ message: "invalid_area" });
  });

  it("a rename can't leave an area nameless", async () => {
    const { store } = await seller(database, "areas-n");
    const zone = await zoneOf(store.id);
    const area = await addArea(database, store.id, zone.id, { name: { en: "Only English" }, fee: null });
    await expect(updateArea(database, store.id, area.id, { name: {}, fee: null }, ["ku", "ar", "en"])).rejects.toMatchObject({ message: "name_required" });
  });

  it("another store's zone or area is NOT_FOUND: no adding to, renaming or removing it", async () => {
    const a = await seller(database, "areas-a");
    const b = await seller(database, "areas-b");
    const zoneA = await zoneOf(a.store.id);
    const areaA = await addArea(database, a.store.id, zoneA.id, { name: { en: "A's area" }, fee: 1_000 });
    await expect(addArea(database, b.store.id, zoneA.id, { name: { en: "intruder" }, fee: 0 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateArea(database, b.store.id, areaA.id, { name: { en: "hijacked" }, fee: 0 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteArea(database, b.store.id, areaA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listAreas(database, b.store.id)).toEqual([]);
    const still = await database.query.deliveryAreas.findFirst({ where: eq(deliveryAreas.id, areaA.id) });
    expect(still).toMatchObject({ name: { en: "A's area" }, fee: 1_000 });
  });

  it("the delivery screen's area actions invalidate the storefront cache", () => {
    const src = readFileSync("src/server/actions/dashboard.ts", "utf8");
    for (const fn of ["saveAreaAction", "deleteAreaAction"]) {
      const body = src.split(`export async function ${fn}`)[1]!.split("\nexport ")[0]!;
      expect(body, fn).toMatch(/invalidateStore\(store\.id\)/);
    }
  });
});
