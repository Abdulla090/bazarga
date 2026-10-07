import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IRAQ_GOVERNORATES } from "@/lib/governorates";
import { ORDER_STATUSES } from "@/lib/order-status";
import { DISCOUNT_TYPES } from "@/lib/discounts";
import { THEME_PRESETS } from "@/lib/theme";

/**
 * Upgrade path v1 (0000) → sprint schema (0001) on a database that already holds v1 data:
 * statuses are remapped, zones linked to governorates, missing governorates added inactive, nothing lost.
 */
const SRC = path.join(process.cwd(), "drizzle");
let tmp: string;

function folderUpTo(n: number): string {
  const dir = path.join(tmp, `upto-${n}`);
  cpSync(SRC, dir, { recursive: true });
  const journalPath = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, n);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

type Row = Record<string, unknown>;
const rows = async (pg: PGlite, q: string, p: unknown[] = []) => (await pg.query<Row>(q, p)).rows;

describe("migration 0001 (sprint schema) upgrading v1 data", () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  let storeId: string;

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "mm-mig-"));
    await migrate(db, { migrationsFolder: folderUpTo(1) });

    // --- v1 data
    const [u] = await rows(pg, `insert into users (email, password_hash, name) values ('v1@x.iq','h','V1') returning id`);
    const [s] = await rows(pg, `insert into stores (owner_id, name, slug) values ($1,'V1 shop','v1-shop') returning id`, [u!.id]);
    storeId = s!.id as string;
    for (const [k, fee, active] of [
      ["erbil", 3000, true],
      ["mosul", 5000, true],
      ["zakho", 4500, true],
      ["ranya", 4000, true],
      ["basra", 7000, false],
    ] as const) {
      await pg.query(`insert into delivery_zones (store_id, city_key, name, fee, is_active) values ($1,$2,'{"en":"x"}',$3,$4)`, [storeId, k, fee, active]);
    }
    let n = 1000;
    for (const [status, city] of [
      ["new", "erbil"],
      ["confirmed", "mosul"],
      ["out_for_delivery", "zakho"],
      ["delivered", "ranya"],
      ["cancelled", "erbil"],
    ] as const) {
      const [o] = await rows(
        pg,
        `insert into orders (store_id, number, public_id, customer_name, customer_phone, city_key, city_name, address, subtotal, delivery_fee, total, status, payment_method)
         values ($1,$2,$3,'C','9647501111111',$4,'X','addr',1000,0,1000,$5,'cod') returning id`,
        [storeId, ++n, `pub-${n}`, city, status],
      );
      await pg.query(`insert into order_events (order_id, from_status, to_status) values ($1, null, 'new')`, [o!.id]);
      if (status !== "new") await pg.query(`insert into order_events (order_id, from_status, to_status) values ($1, 'new', $2)`, [o!.id, status]);
    }
    await pg.query(`insert into products (store_id, name, price) values ($1, '{"en":"p"}', 5000)`, [storeId]);
    await pg.query(`insert into product_images (product_id, store_id, url) select id, store_id, '/images/a.jpg' from products`);

    await migrate(db, { migrationsFolder: SRC });
  });
  afterAll(async () => {
    await pg.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("remaps legacy order statuses on orders and history", async () => {
    const os = await rows(pg, `select status::text as s from orders order by number`);
    expect(os.map((r) => r.s)).toEqual(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
    const ev = await rows(pg, `select from_status::text f, to_status::text t from order_events`);
    expect(ev.length).toBe(9);
    const all = ev.flatMap((r) => [r.f, r.t]).filter(Boolean);
    expect(all).not.toContain("new");
    expect(all).not.toContain("out_for_delivery");
    expect(all).toContain("pending");
    expect(all).toContain("shipped");
  });

  it("order_status enum matches src/lib/order-status.ts exactly, default is pending", async () => {
    const e = await rows(pg, `select unnest(enum_range(null::order_status))::text v`);
    expect(e.map((r) => r.v)).toEqual([...ORDER_STATUSES]);
    const [d] = await rows(pg, `select column_default from information_schema.columns where table_name='orders' and column_name='status'`);
    expect(String(d!.column_default)).toContain("pending");
  });

  it("other enums match their TS sources", async () => {
    const d = await rows(pg, `select unnest(enum_range(null::discount_type))::text v`);
    expect(d.map((r) => r.v)).toEqual([...DISCOUNT_TYPES]);
    const t = await rows(pg, `select unnest(enum_range(null::theme_preset))::text v`);
    expect(t.map((r) => r.v)).toEqual([...THEME_PRESETS]);
  });

  it("seeds governorates identical to src/lib/governorates.ts", async () => {
    const g = await rows(pg, `select key, name, region from governorates order by sort`);
    expect(g).toEqual(IRAQ_GOVERNORATES.map((x) => ({ key: x.key, name: x.name, region: x.region })));
    expect(g.length).toBe(19); // 18 + Halabja
  });

  it("links v1 zones to governorates, keeps fees, adds missing governorates inactive", async () => {
    const z = await rows(pg, `select city_key, governorate_key, fee, is_active from delivery_zones where store_id=$1`, [storeId]);
    const by = (k: string) => z.find((r) => r.city_key === k)!;
    expect(by("erbil")).toMatchObject({ governorate_key: "erbil", fee: 3000, is_active: true });
    expect(by("mosul")).toMatchObject({ governorate_key: "ninawa", fee: 5000, is_active: true });
    expect(by("zakho")).toMatchObject({ governorate_key: "duhok", fee: 4500, is_active: true });
    expect(by("ranya")).toMatchObject({ governorate_key: null, fee: 4000 });
    expect(by("basra")).toMatchObject({ governorate_key: "basra", is_active: false });
    // ninawa/duhok are covered by mosul/zakho → not duplicated
    expect(z.find((r) => r.city_key === "ninawa")).toBeUndefined();
    expect(z.find((r) => r.city_key === "duhok")).toBeUndefined();
    const covered = new Set(z.map((r) => r.governorate_key).filter(Boolean));
    expect(covered.size).toBe(19);
    const added = z.filter((r) => !["erbil", "mosul", "zakho", "ranya", "basra"].includes(r.city_key as string));
    expect(added.length).toBe(15);
    expect(added.every((r) => r.is_active === false)).toBe(true);
  });

  it("backfills orders.governorate_key and keeps every order", async () => {
    const o = await rows(pg, `select city_key, governorate_key, discount_amount from orders order by number`);
    expect(o.map((r) => r.governorate_key)).toEqual(["erbil", "ninawa", "duhok", null, "erbil"]);
    expect(o.every((r) => r.discount_amount === 0)).toBe(true);
  });

  it("existing stores and images get safe defaults", async () => {
    const [s] = await rows(pg, `select theme_preset::text p, accent_color, about, return_policy, free_delivery_threshold from stores`);
    expect(s).toEqual({ p: "bazaar", accent_color: null, about: {}, return_policy: {}, free_delivery_threshold: null });
    const [i] = await rows(pg, `select width, height, renditions, alt from product_images`);
    expect(i).toEqual({ width: null, height: null, renditions: [], alt: {} });
  });

  it("enforces the new constraints", async () => {
    await expect(pg.query(`update stores set accent_color='red'`)).rejects.toThrow();
    await expect(pg.query(`update stores set free_delivery_threshold=0`)).rejects.toThrow();
    await expect(
      pg.query(`insert into discount_codes (store_id, code, type, value) values ($1,'SALE','percentage',150)`, [storeId]),
    ).rejects.toThrow();
    await expect(
      pg.query(`insert into discount_codes (store_id, code, type, value) values ($1,'sale','fixed',1000)`, [storeId]),
    ).rejects.toThrow();
    await pg.query(`insert into discount_codes (store_id, code, type, value) values ($1,'NEWROZ','percentage',10)`, [storeId]);
    await expect(
      pg.query(`insert into discount_codes (store_id, code, type, value) values ($1,'NEWROZ','fixed',1000)`, [storeId]),
    ).rejects.toThrow();
    await expect(pg.query(`update orders set discount_amount = subtotal + 1`)).rejects.toThrow();
    await expect(pg.query(`update product_images set width = 100`)).rejects.toThrow();
    await expect(
      pg.query(`insert into push_subscriptions (audience, endpoint, p256dh, auth) values ('seller','https://p/1','k','a')`),
    ).rejects.toThrow();
    await expect(pg.query(`update delivery_zones set eta_min_days=3, eta_max_days=1 where city_key='erbil'`)).rejects.toThrow();
  });

  it("variant SKUs are unique per store but optional", async () => {
    const [p] = await rows(pg, `select id from products limit 1`);
    const ins = (sku: string | null) =>
      pg.query(`insert into product_variants (product_id, store_id, sku, stock) values ($1,$2,$3,1)`, [p!.id, storeId, sku]);
    await ins(null);
    await ins(null);
    await ins("DRESS-M-RED");
    await expect(ins("DRESS-M-RED")).rejects.toThrow();
  });

  it("is idempotent: re-running all migrations is a no-op", async () => {
    await migrate(db, { migrationsFolder: SRC });
    const [c] = await rows(pg, `select count(*)::int c from governorates`);
    expect(c!.c).toBe(19);
  });
});
