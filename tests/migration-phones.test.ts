import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Migration 0003: legacy "9647…" phones → "+9647…", and the duplicate customer rows that the format change
 * created (same shopper, one row per format) merged into the oldest one, with their orders repointed.
 */
const SRC = path.join(process.cwd(), "drizzle");
let tmp: string;

function folderUpTo(n: number): string {
  const dir = path.join(tmp, `upto-${n}`);
  cpSync(SRC, dir, { recursive: true });
  const journalPath = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  journal.entries = journal.entries.slice(0, n);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

type Row = Record<string, unknown>;

describe("migration 0003 (E.164 phone backfill + customer merge)", () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  const rows = async (q: string, p: unknown[] = []) => (await pg.query<Row>(q, p)).rows;
  const ids: Record<string, string> = {};
  let storeA: string;
  let storeB: string;

  async function customer(key: string, storeId: string, phone: string, createdAt: string, o: { name?: string; count?: number; spent?: number; last?: string | null; landmark?: string } = {}) {
    const [c] = await rows(
      `insert into customers (store_id, name, phone, orders_count, total_spent, last_order_at, created_at, landmark, address, city_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'erbil') returning id`,
      [storeId, o.name ?? key, phone, o.count ?? 1, o.spent ?? 10_000, o.last === undefined ? createdAt : o.last, createdAt, o.landmark ?? null, `${key} street`],
    );
    ids[key] = c!.id as string;
  }
  let n = 2000;
  async function order(key: string, storeId: string, customerKey: string | null, phone: string) {
    const [o] = await rows(
      `insert into orders (store_id, number, public_id, customer_id, customer_name, customer_phone, city_key, city_name, address, subtotal, delivery_fee, total, payment_method)
       values ($1,$2,$3,$4,'C',$5,'erbil','Erbil','addr',10000,0,10000,'cod') returning id`,
      [storeId, ++n, `pub-${n}`, customerKey ? ids[customerKey] : null, phone],
    );
    ids[key] = o!.id as string;
  }

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "mm-mig3-"));
    await migrate(db, { migrationsFolder: folderUpTo(3) });
    const [u] = await rows(`insert into users (email, password_hash, name) values ('m3@x.iq','h','M3') returning id`);
    storeA = (await rows(`insert into stores (owner_id, name, slug) values ($1,'A','mig3-a') returning id`, [u!.id]))[0]!.id as string;
    storeB = (await rows(`insert into stores (owner_id, name, slug) values ($1,'B','mig3-b') returning id`, [u!.id]))[0]!.id as string;

    // Store A: Shilan ordered twice under the legacy format (v1), then once more as E.164 → two rows.
    await customer("shilanOld", storeA, "9647701112233", "2026-01-01T10:00:00Z", { name: "Shilan", count: 2, spent: 40_000, last: "2026-02-01T10:00:00Z" });
    await customer("shilanNew", storeA, "+9647701112233", "2026-05-01T10:00:00Z", { name: "Shilan Aziz", count: 1, spent: 15_000, last: "2026-05-01T10:00:00Z", landmark: "Behind the Bazaar Mosque" });
    await order("o1", storeA, "shilanOld", "9647701112233");
    await order("o2", storeA, "shilanOld", "9647701112233");
    await order("o3", storeA, "shilanNew", "+9647701112233");
    // Store A: a legacy-only customer (no duplicate) and a non-Iraqi number that must be left alone.
    await customer("legacyOnly", storeA, "9647509998877", "2026-01-05T10:00:00Z");
    await order("o4", storeA, "legacyOnly", "9647509998877");
    await customer("diaspora", storeA, "4915112345678", "2026-01-06T10:00:00Z");
    await order("o5", storeA, "diaspora", "4915112345678");
    // Store B: the same number as Shilan — a different store's customer, never merged across stores.
    await customer("shilanB", storeB, "9647701112233", "2026-03-01T10:00:00Z");
    await order("o6", storeB, "shilanB", "9647701112233");
    // A guest order with no customer row still gets its phone fixed.
    await order("o7", storeB, null, "9647801234567");

    await migrate(db, { migrationsFolder: SRC });
  });
  afterAll(async () => {
    await pg.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("merges a store's duplicate customers into the oldest row, with summed totals and the latest details", async () => {
    const a = await rows(`select * from customers where store_id = $1 and phone = '+9647701112233'`, [storeA]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: ids.shilanOld, name: "Shilan Aziz", orders_count: 3, total_spent: 55_000, landmark: "Behind the Bazaar Mosque", address: "shilanNew street" });
    expect(new Date(a[0]!.last_order_at as string).toISOString()).toBe("2026-05-01T10:00:00.000Z");
    expect(await rows(`select id from customers where id = $1`, [ids.shilanNew])).toEqual([]);
  });

  it("repoints every order of the merged rows to the kept customer", async () => {
    const o = await rows(`select id, customer_id from orders where store_id = $1 and customer_phone = '+9647701112233' order by number`, [storeA]);
    expect(o.map((r) => r.customer_id)).toEqual([ids.shilanOld, ids.shilanOld, ids.shilanOld]);
  });

  it("rewrites legacy 9647… phones to +9647… on customers and orders, and leaves anything else alone", async () => {
    expect((await rows(`select phone from customers where id = $1`, [ids.legacyOnly]))[0]!.phone).toBe("+9647509998877");
    expect((await rows(`select customer_phone from orders where id = $1`, [ids.o4]))[0]!.customer_phone).toBe("+9647509998877");
    expect((await rows(`select phone from customers where id = $1`, [ids.diaspora]))[0]!.phone).toBe("4915112345678");
    expect((await rows(`select customer_phone from orders where id = $1`, [ids.o5]))[0]!.customer_phone).toBe("4915112345678");
    expect((await rows(`select customer_phone from orders where id = $1`, [ids.o7]))[0]!.customer_phone).toBe("+9647801234567");
    expect(await rows(`select id from customers where phone ~ '^9647[0-9]{9}$'`)).toEqual([]);
    expect(await rows(`select id from orders where customer_phone ~ '^9647[0-9]{9}$'`)).toEqual([]);
  });

  it("never merges across stores", async () => {
    const b = await rows(`select id, phone, orders_count from customers where store_id = $1`, [storeB]);
    expect(b).toEqual([{ id: ids.shilanB, phone: "+9647701112233", orders_count: 1 }]);
    expect((await rows(`select customer_id from orders where id = $1`, [ids.o6]))[0]!.customer_id).toBe(ids.shilanB);
  });

  it("is journalled as 0003", () => {
    const journal = JSON.parse(readFileSync(path.join(SRC, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
    expect(journal.entries[3]?.tag).toBe("0003_phone_e164_backfill");
  });

  it("leaves no orphaned orders and no helper table behind", async () => {
    expect(await rows(`select id from orders where customer_id is not null and customer_id not in (select id from customers)`)).toEqual([]);
    expect(await rows(`select 1 from pg_tables where tablename = '_customer_merge'`)).toEqual([]);
    expect((await rows(`select count(*)::int as n from orders`))[0]!.n).toBe(7);
  });
});
