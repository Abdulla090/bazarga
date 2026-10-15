import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNotNull, like } from "drizzle-orm";
import type { Db } from "@/server/db";
import { orders } from "@/server/db/schema";
import { placeOrder } from "@/server/services/orders";
import { buildSourceRows, getStoreAnalytics, recordView } from "@/server/services/analytics";
import { checkoutSchema, orderSourceSchema } from "@/lib/validation";
import { HOME_PAGE, VISITORS_PAGE } from "@/lib/analytics";
import {
  buildCaption,
  CAPTION_LOCALES,
  ORDER_SOURCES,
  parseSource,
  productUrl,
  SHARE_PLATFORMS,
  shareImageName,
  sourceFromPage,
  sourcePage,
  withSource,
} from "@/lib/social";
import { captureSource, readSource } from "@/lib/source-client";
import { dirFor, IMAGE_TEXT, startX, wrapLines } from "@/lib/share-canvas";
import { DEMO_PHONE_PREFIX, DEMO_SOURCES, seedAnalytics } from "../scripts/seed-analytics";
import { checkout, product, seller, testDb } from "./support/db";

const msgs = (l: string) => JSON.parse(readFileSync(path.join(process.cwd(), "messages", `${l}.json`), "utf8"));
const LOCALES = ["ku", "ar", "en", "kmr"];

describe("social-first: source allowlist + links", () => {
  it("accepts only allowlisted platforms, case-insensitively", () => {
    expect(parseSource("tiktok")).toBe("tiktok");
    expect(parseSource(" TikTok ")).toBe("tiktok");
    expect(parseSource("myspace")).toBeNull();
    expect(parseSource("<script>")).toBeNull();
    expect(parseSource(undefined)).toBeNull();
    expect(parseSource(42)).toBeNull();
    for (const s of ORDER_SOURCES) expect(orderSourceSchema.parse(s)).toBe(s);
    expect(orderSourceSchema.safeParse("evil").success).toBe(false);
  });

  it("tags product links with ?src=, replacing an old one and keeping other params and the hash", () => {
    const u = productUrl("https://bazarga.vercel.app/", "hawler-bazaar", "0d2c7c38-0000-4000-8000-000000000000");
    expect(u).toBe("https://bazarga.vercel.app/s/hawler-bazaar/p/0d2c7c38-0000-4000-8000-000000000000");
    expect(withSource(u, "tiktok")).toBe(`${u}?src=tiktok`);
    expect(withSource(`${u}?src=qr&v=2#buy`, "instagram")).toBe(`${u}?src=instagram&v=2#buy`);
    for (const p of SHARE_PLATFORMS) expect(parseSource(new URL(withSource(u, p)).searchParams.get("src"))).toBe(p);
  });

  it("page keys round-trip and unknown keys are ignored", () => {
    expect(sourcePage("tiktok")).toBe("src:tiktok");
    expect(sourceFromPage("src:tiktok")).toBe("tiktok");
    expect(sourceFromPage("src:evil")).toBeNull();
    expect(sourceFromPage(HOME_PAGE)).toBeNull();
  });

  it("captions carry name, price, store, link and hashtags in ku / ar / en", () => {
    for (const l of CAPTION_LOCALES) {
      const c = buildCaption(l, { name: "کراسی کەتان", price: "85,000 IQD", store: "Studio Hawler", link: "https://x.app/s/a/p/1?src=tiktok" });
      expect(c).toContain("کراسی کەتان");
      expect(c).toContain("85,000 IQD");
      expect(c).toContain("https://x.app/s/a/p/1?src=tiktok");
      expect(c).toContain("#StudioHawler");
      expect((c.match(/#/g) ?? []).length).toBeGreaterThanOrEqual(5);
    }
    expect(buildCaption("ku", { name: "a", price: "1", store: "s", link: "l" })).toContain("پارە لە کاتی گەیاندندا");
  });

  it("download names are safe", () => {
    expect(shareImageName("hawler-bazaar", "0d2c7c38-0000-4000-8000-000000000000", "story")).toBe("hawler-bazaar-0d2c7c38-story.png");
    expect(shareImageName("../x", "id", "square")).toBe("x-id-square.png");
  });
});

describe("social-first: storefront capture (sessionStorage + cookie)", () => {
  const fakeEnv = () => {
    const store = new Map<string, string>();
    return {
      session: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
      doc: { cookie: "" },
    };
  };

  it("saves an allowlisted ?src and reads it back; ignores junk", () => {
    const e = fakeEnv();
    expect(captureSource("hawler-bazaar", "?src=TikTok&x=1", e)).toBe("tiktok");
    expect(readSource("hawler-bazaar", e)).toBe("tiktok");
    expect(e.doc.cookie).toContain("bzsrc_hawler-bazaar=tiktok");
    expect(e.doc.cookie).toContain("samesite=lax");
    expect(captureSource("hawler-bazaar", "?src=evil", e)).toBeNull();
    expect(readSource("hawler-bazaar", e)).toBe("tiktok");
    expect(readSource("other-store", e)).toBeNull();
  });

  it("falls back to the 7-day cookie when the tab session is new", () => {
    const e = { session: { getItem: () => null, setItem: () => {} }, doc: { cookie: "a=1; bzsrc_hawler-bazaar=instagram; b=2" } };
    expect(readSource("hawler-bazaar", e)).toBe("instagram");
    expect(readSource("hawler-bazaar", { session: null, doc: { cookie: "bzsrc_hawler-bazaar=evil" } })).toBeNull();
  });
});

describe("social-first: canvas text layout (RTL aware)", () => {
  const mono = (s: string) => s.length * 10;
  it("wraps to max lines with an ellipsis and never returns an over-wide line", () => {
    expect(wrapLines(mono, "one two three", 200, 2)).toEqual(["one two three"]);
    const l = wrapLines(mono, "aaaa bbbb cccc dddd eeee ffff", 90, 2);
    expect(l).toHaveLength(2);
    expect(l[1]!.endsWith("…")).toBe(true);
    for (const x of l) expect(mono(x)).toBeLessThanOrEqual(90);
    expect(wrapLines(mono, "سەرەتای ناوێکی زۆر درێژی کاڵا", 120, 1)[0]!.endsWith("…")).toBe(true);
    expect(wrapLines(mono, "", 100, 2)).toEqual([]);
  });
  it("anchors start-aligned text on the right edge in RTL", () => {
    expect(dirFor("ku")).toBe("rtl");
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
    expect(startX("rtl", 72, 936)).toBe(1008);
    expect(startX("ltr", 72, 936)).toBe(72);
    for (const l of CAPTION_LOCALES) expect(Object.values(IMAGE_TEXT[l]).every(Boolean)).toBe(true);
  });
});

describe("social-first: checkout + analytics", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("checkout schema keeps a valid source and silently drops an invalid one", () => {
    const base = { items: [{ productId: "0d2c7c38-0000-4000-8000-000000000000", quantity: 1 }], customerName: "Shilan", phone: "07701112233", cityKey: "erbil", address: "Near the mosque", paymentMethod: "cod" };
    expect(checkoutSchema.parse({ ...base, source: "tiktok" }).source).toBe("tiktok");
    expect(checkoutSchema.parse({ ...base, source: "evil" }).source).toBeUndefined();
    expect(checkoutSchema.parse(base).source).toBeUndefined();
  });

  it("stores orders.source and shows it in Orders by source with conversion per platform", async () => {
    const { store } = await seller(database, "srcan");
    const p = await product(database, store.id, 25_000);
    const now = new Date();
    const o1 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { source: "tiktok", phone: "9647701110001" }));
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { source: "tiktok", phone: "9647701110002" }));
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { source: "instagram", phone: "9647701110003" }));
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "9647701110004" }));
    expect((await database.query.orders.findFirst({ where: eq(orders.id, o1.id) }))!.source).toBe("tiktok");
    for (let i = 0; i < 10; i++) await recordView(database, store.id, sourcePage("tiktok"), { newVisitor: false, now });
    for (let i = 0; i < 4; i++) await recordView(database, store.id, sourcePage("instagram"), { newVisitor: false, now });
    for (let i = 0; i < 20; i++) await recordView(database, store.id, HOME_PAGE, { newVisitor: true, now });

    const a = await getStoreAnalytics(database, store.id, { days: 7, locale: "en", now });
    expect(a.bySource.map((r) => r.source)).toEqual(["tiktok", "instagram", "direct"]);
    const tk = a.bySource[0]!;
    expect(tk).toMatchObject({ orders: 2, visits: 10, conversion: 20 });
    expect(a.bySource[1]).toMatchObject({ orders: 1, visits: 4, conversion: 25 });
    // direct = all visitors minus social arrivals
    expect(a.bySource[2]).toMatchObject({ source: "direct", orders: 1, visits: 6 });
    // Visitor totals are unchanged by the src:* rows.
    expect(a.totals.visitors).toBe(20);
  });

  it("buildSourceRows folds unknown sources into direct and skips empty rows", () => {
    const rows = buildSourceRows([{ source: "myspace", orders: 2, revenue: 10 }, { source: "qr", orders: "1", revenue: "5" }], new Map([["tiktok", 0]]), 0);
    expect(rows).toEqual([
      { source: "qr", orders: 1, revenue: 5, visits: 0, conversion: null },
      { source: "direct", orders: 2, revenue: 10, visits: 0, conversion: null },
    ]);
  });

  it("demo seed gives most demo orders a source, TikTok largest, and stays idempotent", async () => {
    const { store } = await seller(database, "srcseed");
    await product(database, store.id, 25_000);
    await product(database, store.id, 40_000);
    const NOW = new Date("Mon 2026-10-12 3:00 PM (UTC+03:00)");
    await seedAnalytics(database, store.id, NOW);
    const demo = await database.select({ s: orders.source }).from(orders).where(and(eq(orders.storeId, store.id), like(orders.customerPhone, `${DEMO_PHONE_PREFIX}%`)));
    const count = (s: string | null) => demo.filter((o) => o.s === s).length;
    expect(count("tiktok")).toBeGreaterThan(count("instagram"));
    expect(count("instagram")).toBeGreaterThan(count("whatsapp"));
    expect(count(null) / demo.length).toBeLessThan(0.15);
    const before = await database.select({ s: orders.source }).from(orders).where(and(eq(orders.storeId, store.id), isNotNull(orders.source)));
    await seedAnalytics(database, store.id, NOW);
    const after = await database.select({ s: orders.source }).from(orders).where(and(eq(orders.storeId, store.id), isNotNull(orders.source)));
    expect(after.length).toBe(before.length);
    const a = await getStoreAnalytics(database, store.id, { days: 30, locale: "en", now: NOW });
    expect(a.bySource[0]!.source).toBe("tiktok");
    expect(a.bySource.find((r) => r.source === "tiktok")!.visits).toBeGreaterThan(0);
    expect(DEMO_SOURCES[0]![0]).toBe("tiktok");
    expect(a.totals.visitors).toBeGreaterThan(0);
    expect(VISITORS_PAGE).toBe("*");
  });
});

describe("social-first: migration + copy", () => {
  it("0018 is additive (nullable column + index) and journaled", () => {
    const sql = readFileSync(path.join(process.cwd(), "drizzle", "0018_order_source.sql"), "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "source" text;/);
    expect(sql).not.toMatch(/NOT NULL|DROP|RENAME/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "orders_store_source_idx"/);
    const journal = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"));
    expect(journal.entries.at(-1).tag).toBe("0018_order_source");
  });

  it("hero + DMs vs Bazarga + share + source copy exist in all 4 locales", () => {
    const keysOf = (o: Record<string, unknown>) => Object.keys(o).sort();
    const en = msgs("en");
    for (const l of LOCALES) {
      const m = msgs(l);
      expect(keysOf(m.landing.dvb)).toEqual(keysOf(en.landing.dvb));
      expect(keysOf(m.productShare)).toEqual(keysOf(en.productShare));
      for (const k of ["sourceTitle", "sourceHint", "sourceTop", "sourceBestConv", "sourceEmpty", "sourceDirect", "sourceVisits"]) expect(m.analytics[k]).toBeTruthy();
      expect(m.orders.fromSource).toContain("{source}");
      expect(m.landing.heroTitle1).toMatch(/TikTok|تیکتۆک|تيك توك/);
    }
    expect(msgs("ku").landing.heroTitle1).toBe("لە تیکتۆک بەردەوام بە.");
    expect(msgs("ku").landing.dvb.dmBubble).toBe("بەچەندە؟");
  });
});
