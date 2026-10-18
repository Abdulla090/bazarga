import "server-only";
import { inArray } from "drizzle-orm";
import type { Db } from "../db";
import { storeLimitOverrides } from "../db/schema";
import { applyOverride, type LimitKey } from "@/lib/admin";

/** Effective limit for one store: the admin override (store_limit_overrides, docs/ADMIN.md) when set, else the plan's. */
export async function withOverride(database: Db, storeId: string, key: LimitKey, planLimit: number): Promise<number> {
  return withOverrides(database, [storeId], key, planLimit);
}

/** Across several stores (the account-wide store limit): the highest override wins. */
export async function withOverrides(database: Db, storeIds: string[], key: LimitKey, planLimit: number): Promise<number> {
  if (!storeIds.length) return planLimit;
  const rows = await database.select().from(storeLimitOverrides).where(inArray(storeLimitOverrides.storeId, storeIds));
  const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
  return vals.length ? applyOverride(planLimit, Math.max(...vals)) : planLimit;
}
