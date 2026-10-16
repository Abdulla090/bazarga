import { and, count, countDistinct, eq, ne, notLike, sql } from "drizzle-orm";
import type { Db } from "../db";
import { orders, products, stores, users, waitlist } from "../db/schema";
import { TEST_EMAIL_DOMAIN, type LiveStats } from "@/lib/live-stats";

/** The seeded demo seller (scripts/seed.ts); its store and orders are not real traction. */
const DEMO_EMAIL = (process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app").toLowerCase();

/**
 * Real counts for the landing band: sellers (accounts that own a store), live stores (active, with at least one active
 * product), orders placed (not cancelled), waitlist signups. The demo seller and our own @example.com test accounts are excluded.
 */
export async function loadLiveStats(database: Db): Promise<LiveStats> {
  const real = and(ne(users.email, DEMO_EMAIL), notLike(users.email, `%${TEST_EMAIL_DOMAIN}`));
  const [sellers] = await database
    .select({ n: countDistinct(stores.ownerId) })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.ownerId))
    .where(real);
  const [live] = await database
    .select({ n: count() })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.ownerId))
    .where(
      and(
        real,
        eq(stores.isActive, true),
        sql`exists (select 1 from ${products} where ${products.storeId} = ${stores.id} and ${products.isActive} = true)`,
      ),
    );
  const [placed] = await database
    .select({ n: count() })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .innerJoin(users, eq(users.id, stores.ownerId))
    .where(and(real, ne(orders.status, "cancelled")));
  const [wl] = await database.select({ n: count() }).from(waitlist);
  return { sellers: sellers?.n ?? 0, stores: live?.n ?? 0, orders: placed?.n ?? 0, waitlist: wl?.n ?? 0 };
}
