import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { deliveryZones, stores } from "@/server/db/schema";
import { IRAQI_CITIES } from "@/lib/cities";
import { buildSetupChecklist, hasUsableWhatsapp, isDeliveryCustomized, SETUP_STEPS, type SetupFacts } from "@/lib/setup-checklist";
import { confirmDeliveryFees, getSetupChecklist, loadSetupFacts, markLinkShared } from "@/server/services/setup";
import { addArea, updateZoneFee } from "@/server/services/settings";
import { setProductActive } from "@/server/services/catalog";
import { placeOrder } from "@/server/services/orders";
import { checkout, product, seller, testDb } from "./support/db";

const blank: SetupFacts = {
  logoUrl: null,
  activeProductCount: 0,
  deliveryCustomized: false,
  deliveryConfirmedAt: null,
  whatsapp: null,
  linkSharedAt: null,
  orderCount: 0,
};
const doneKeys = (f: SetupFacts) => buildSetupChecklist(f).steps.filter((s) => s.done).map((s) => s.key);

describe("buildSetupChecklist (pure)", () => {
  it("a blank store has every step open, in order, starting with the logo", () => {
    const c = buildSetupChecklist(blank);
    expect(c.steps.map((s) => s.key)).toEqual([...SETUP_STEPS]);
    expect(c).toMatchObject({ doneCount: 0, total: 5, complete: false, next: "logo" });
  });

  it("each fact ticks exactly its own step", () => {
    expect(doneKeys({ ...blank, logoUrl: "/api/files/x.webp" })).toEqual(["logo"]);
    expect(doneKeys({ ...blank, activeProductCount: 1 })).toEqual(["product"]);
    expect(doneKeys({ ...blank, deliveryCustomized: true })).toEqual(["delivery"]);
    expect(doneKeys({ ...blank, deliveryConfirmedAt: new Date() })).toEqual(["delivery"]);
    expect(doneKeys({ ...blank, whatsapp: "9647501234567" })).toEqual(["whatsapp"]);
    expect(doneKeys({ ...blank, linkSharedAt: new Date() })).toEqual(["share"]);
    // A first order proves the link reached shoppers even if it was shared outside the dashboard.
    expect(doneKeys({ ...blank, orderCount: 1 })).toEqual(["share"]);
  });

  it("next is the first open step; complete when all five are done", () => {
    expect(buildSetupChecklist({ ...blank, logoUrl: "x", activeProductCount: 2 }).next).toBe("delivery");
    const all = buildSetupChecklist({ ...blank, logoUrl: "x", activeProductCount: 1, deliveryCustomized: true, whatsapp: "+9647701112233", orderCount: 3 });
    expect(all).toMatchObject({ doneCount: 5, complete: true, next: null });
  });

  it("every step links somewhere in the dashboard", () => {
    for (const s of buildSetupChecklist(blank).steps) expect(s.href).toMatch(/^\/dashboard/);
  });
});

describe("hasUsableWhatsapp", () => {
  it("accepts Iraqi mobiles (legacy digits or +964) and international numbers", () => {
    expect(hasUsableWhatsapp("9647501234567")).toBe(true);
    expect(hasUsableWhatsapp("+9647701234567")).toBe(true);
    expect(hasUsableWhatsapp("+4915112345678")).toBe(true);
  });
  it("rejects empty, blank and junk", () => {
    expect(hasUsableWhatsapp(null)).toBe(false);
    expect(hasUsableWhatsapp("")).toBe(false);
    expect(hasUsableWhatsapp("   ")).toBe(false);
    expect(hasUsableWhatsapp("12")).toBe(false);
  });
});

describe("isDeliveryCustomized", () => {
  const seeded = IRAQI_CITIES.map((c) => ({ cityKey: c.key, fee: c.fee, isActive: true, etaMinDays: null, etaMaxDays: null }));
  it("the zones a new store gets are not customised", () => {
    expect(isDeliveryCustomized(seeded, 0, IRAQI_CITIES)).toBe(false);
  });
  it("an area, a changed fee, a disabled/removed/added zone or an ETA counts", () => {
    expect(isDeliveryCustomized(seeded, 1, IRAQI_CITIES)).toBe(true);
    expect(isDeliveryCustomized(seeded.map((z, i) => (i === 0 ? { ...z, fee: z.fee + 500 } : z)), 0, IRAQI_CITIES)).toBe(true);
    expect(isDeliveryCustomized(seeded.map((z, i) => (i === 0 ? { ...z, isActive: false } : z)), 0, IRAQI_CITIES)).toBe(true);
    expect(isDeliveryCustomized(seeded.slice(1), 0, IRAQI_CITIES)).toBe(true);
    expect(isDeliveryCustomized([...seeded, { ...seeded[0]!, cityKey: "ranya" }], 0, IRAQI_CITIES)).toBe(true);
    expect(isDeliveryCustomized(seeded.map((z, i) => (i === 0 ? { ...z, etaMinDays: 1, etaMaxDays: 2 } : z)), 0, IRAQI_CITIES)).toBe(true);
  });
});

describe("setup progress from real store data", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("a fresh store: WhatsApp (from onboarding) done, the rest open", async () => {
    const { store } = await seller(database, "setup-fresh");
    const c = await getSetupChecklist(database, store.id);
    expect(c.steps.filter((s) => s.done).map((s) => s.key)).toEqual(["whatsapp"]);
    expect(c.next).toBe("logo");
  });

  it("progress follows the seller's real changes, through to complete", async () => {
    const { store } = await seller(database, "setup-walk");
    await database.update(stores).set({ whatsapp: null }).where(eq(stores.id, store.id));
    expect((await getSetupChecklist(database, store.id)).doneCount).toBe(0);

    await database.update(stores).set({ logoUrl: "/api/files/stores/x/logo.webp" }).where(eq(stores.id, store.id));
    const p = await product(database, store.id, 12_000);
    let c = await getSetupChecklist(database, store.id);
    expect(c.steps.filter((s) => s.done).map((s) => s.key)).toEqual(["logo", "product"]);

    // An inactive product doesn't count.
    await setProductActive(database, store.id, p.id, false);
    expect((await loadSetupFacts(database, store.id)).activeProductCount).toBe(0);
    await setProductActive(database, store.id, p.id, true);

    const erbil = (await database.query.deliveryZones.findFirst({
      where: and(eq(deliveryZones.storeId, store.id), eq(deliveryZones.cityKey, "erbil")),
    }))!;
    await updateZoneFee(database, store.id, erbil.id, erbil.fee + 1_000, true);
    await database.update(stores).set({ whatsapp: "9647501234567" }).where(eq(stores.id, store.id));
    c = await getSetupChecklist(database, store.id);
    expect(c).toMatchObject({ doneCount: 4, next: "share" });

    expect(await markLinkShared(database, store.id)).toBe(true);
    c = await getSetupChecklist(database, store.id);
    expect(c).toMatchObject({ doneCount: 5, complete: true });
  });

  it("delivery: an added area or 'fees look right' completes it; confirm and share keep their first time", async () => {
    const a = await seller(database, "setup-area");
    const zone = (await database.query.deliveryZones.findFirst({ where: eq(deliveryZones.storeId, a.store.id) }))!;
    await addArea(database, a.store.id, zone.id, { name: { en: "Ankawa" }, fee: null });
    expect((await loadSetupFacts(database, a.store.id)).deliveryCustomized).toBe(true);

    const b = await seller(database, "setup-confirm");
    const first = new Date("2026-10-01T10:00:00Z");
    expect(await confirmDeliveryFees(database, b.store.id, first)).toBe(true);
    expect(await confirmDeliveryFees(database, b.store.id, new Date())).toBe(false);
    expect((await loadSetupFacts(database, b.store.id)).deliveryConfirmedAt?.toISOString()).toBe(first.toISOString());
    expect(await markLinkShared(database, b.store.id, first)).toBe(true);
    expect(await markLinkShared(database, b.store.id)).toBe(false);
    expect((await loadSetupFacts(database, b.store.id)).linkSharedAt?.toISOString()).toBe(first.toISOString());
  });

  it("a first order ticks 'share' without the dashboard button", async () => {
    const { store } = await seller(database, "setup-order");
    const p = await product(database, store.id, 5_000);
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    const facts = await loadSetupFacts(database, store.id);
    expect(facts).toMatchObject({ orderCount: 1, linkSharedAt: null });
    expect(buildSetupChecklist(facts).steps.find((s) => s.key === "share")!.done).toBe(true);
  });

  it("is tenant-scoped: one seller's setup never moves another's", async () => {
    const a = await seller(database, "setup-ta");
    const b = await seller(database, "setup-tb");
    await product(database, a.store.id, 1_000);
    await markLinkShared(database, a.store.id);
    await confirmDeliveryFees(database, a.store.id);
    const fb = await loadSetupFacts(database, b.store.id);
    expect(fb).toMatchObject({ activeProductCount: 0, linkSharedAt: null, deliveryConfirmedAt: null, deliveryCustomized: false });
  });

  it("unknown store id → NOT_FOUND", async () => {
    await expect(loadSetupFacts(database, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("setup checklist wiring", () => {
  it("ku, ar, en and kmr have every checklist string", () => {
    for (const l of ["ku", "ar", "en", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { setup: Record<string, Record<string, string> | string> };
      for (const k of ["title", "subtitle", "progress", "done", "shareNative"]) expect(m.setup[k], `${l}.${k}`).toBeTruthy();
      for (const step of SETUP_STEPS) {
        const s = m.setup[step] as Record<string, string>;
        expect(s.title, `${l}.${step}.title`).toBeTruthy();
        expect(s.desc, `${l}.${step}.desc`).toBeTruthy();
        expect(s.cta, `${l}.${step}.cta`).toBeTruthy();
      }
      expect((m.setup.delivery as Record<string, string>).confirm).toBeTruthy();
      expect(m.setup.progress).toContain("{done}");
      expect(m.setup.progress).toContain("{total}");
    }
  });
  it("migration 0004 only adds nullable columns to stores", () => {
    const sql = readFileSync("drizzle/0004_seller_setup_checklist.sql", "utf8");
    expect(sql).toMatch(/ALTER TABLE "stores" ADD COLUMN "link_shared_at" timestamp with time zone;/);
    expect(sql).toMatch(/ALTER TABLE "stores" ADD COLUMN "delivery_confirmed_at" timestamp with time zone;/);
    expect(sql).not.toMatch(/NOT NULL|DROP/);
  });
});

describe("share step follow-up", () => {
  it("the checklist's share step links to the share kit", () => {
    const step = buildSetupChecklist(blank).steps.find((st) => st.key === "share")!;
    expect(step.href).toBe("/dashboard/share");
    const src = readFileSync("src/components/dashboard/SetupChecklist.tsx", "utf8");
    expect(src).toMatch(/s\.key === "share"[\s\S]*ShareLinkButtons[\s\S]*href=\{s\.href\}/);
  });

  it("every share-kit copy / download / WhatsApp control sits inside a click recorder that calls markLinkSharedAction", () => {
    const rec = readFileSync("src/components/dashboard/RecordShareClicks.tsx", "utf8");
    expect(rec).toMatch(/^"use client";/);
    expect(rec).toContain("markLinkSharedAction");
    const page = readFileSync("src/app/dashboard/share/page.tsx", "utf8");
    // Split into recorder blocks; every interactive control must be inside one.
    const inside = [...page.matchAll(/<RecordShareClicks[\s\S]*?<\/RecordShareClicks>/g)].map((m) => m[0]).join("\n");
    expect(page.match(/<RecordShareClicks/g)?.length).toBe(4);
    for (const needle of ["<CopyButton text={url}", "<CopyButton text={bio}", "waShareLink(bio)", "/api/share/qr?format=png&download=1", "/api/share/qr?format=svg&download=1", "/api/share/story?lang=${l}&download=1"]) {
      expect(inside, needle).toContain(needle);
    }
    const outside = page.slice(page.indexOf("return (")).replace(/<RecordShareClicks[\s\S]*?<\/RecordShareClicks>/g, "");
    expect(outside).not.toMatch(/<CopyButton|download\b|wa\.me|waShareLink/);
  });
});
