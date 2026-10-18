import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import {
  aiUsage,
  orders,
  productImages,
  productStudioUsage,
  products,
  sessions,
  storeLimitOverrides,
  storeMembers,
  storePlanHistory,
  stores,
  upgradeRequests,
  users,
  waitlist,
} from "../db/schema";
import { AppError } from "../errors";
import { ADMIN_PAGE_SIZE, LIMIT_KEYS, dailySeries, mrrEstimate, periodDays, type AdminPeriod, type LimitKey, type PlatformRole, type UserStatus } from "@/lib/admin";
import { PLAN_IDS, getPlan, normalizePlan, type PlanId } from "@/lib/plans";
import { ORDER_STATUSES, isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { studioPeriod } from "../services/studio-quota";
import { isValidSlug } from "@/lib/slug";

const like = (q: string) => `%${q.trim().replace(/[%_\\]/g, "").slice(0, 80)}%`;
const pageOf = (p?: number) => Math.max(1, Math.min(Number.isFinite(p) ? Number(p) : 1, 10_000));

// ---------------------------------------------------------------- overview
const NOT_SOLD = sql`('cancelled','refused','returned')`;

/**
 * Every overview number, straight from the database (no samples, no seeded series): counts and sums over users,
 * stores, products, orders, waitlist, upgrade requests, images, AI and Studio usage. Daily series cover the chosen
 * period (7d / 30d / 90d / all, "all" from the first account) and are all zeros when nothing happened.
 */
export async function overviewKpis(database: Db, period: AdminPeriod = "30d", now = new Date()) {
  // "all" starts the chart at the oldest account or order (orders can predate accounts, e.g. imported or seeded ones).
  const [first] = await database
    .select({ at: sql<Date | string | null>`least((select min(${users.createdAt}) from ${users}), (select min(${orders.createdAt}) from ${orders}))` })
    .from(sql`(select 1) as one`);
  const firstAt = first?.at ? new Date(first.at) : null;
  const days = periodDays(period, firstAt, now);
  const chartSince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86_400_000);
  // Period totals for "all" have no lower bound at all, so they always equal the all-time totals.
  const since = period === "all" ? new Date(0) : chartSince;
  const month = studioPeriod(now);
  const [
    [u], [s], [p], [o], orderStatusRows, planRows, paidRows, signupRows, orderRows, [w], [pend], [img], aiRows, [studio],
  ] = await Promise.all([
    database
      .select({
        n: sql<number>`count(*)::int`,
        verified: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`,
        fresh: sql<number>`count(*) filter (where ${users.createdAt} >= ${since})::int`,
        sellers: sql<number>`(select count(distinct ${stores.ownerId})::int from ${stores})`,
      })
      .from(users),
    database
      .select({
        n: sql<number>`count(*)::int`,
        live: sql<number>`count(*) filter (where ${stores.isActive} and ${stores.suspendedAt} is null)::int`,
        unpublished: sql<number>`count(*) filter (where not ${stores.isActive} and ${stores.suspendedAt} is null)::int`,
        suspended: sql<number>`count(*) filter (where ${stores.suspendedAt} is not null)::int`,
        featured: sql<number>`count(*) filter (where ${stores.featured})::int`,
        fresh: sql<number>`count(*) filter (where ${stores.createdAt} >= ${since})::int`,
      })
      .from(stores),
    database
      .select({
        n: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${products.isActive} and ${products.hiddenByAdminAt} is null)::int`,
        hidden: sql<number>`count(*) filter (where ${products.hiddenByAdminAt} is not null)::int`,
      })
      .from(products),
    database
      .select({
        n: sql<number>`count(*)::int`,
        inPeriod: sql<number>`count(*) filter (where ${orders.createdAt} >= ${since})::int`,
        gmv: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ${NOT_SOLD}), 0)::bigint`,
        gmvPeriod: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ${NOT_SOLD} and ${orders.createdAt} >= ${since}), 0)::bigint`,
      })
      .from(orders),
    database.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    database.select({ plan: stores.plan, n: sql<number>`count(*)::int` }).from(stores).groupBy(stores.plan),
    // Paid plans that are actually running now (no end date = comped/open-ended, or an end date still ahead), store not suspended.
    database
      .select({ plan: stores.plan, n: sql<number>`count(*)::int` })
      .from(stores)
      .where(and(ne(stores.plan, "free"), isNull(stores.suspendedAt), or(isNull(stores.planPeriodEnd), gte(stores.planPeriodEnd, now))))
      .groupBy(stores.plan),
    database.select({ at: users.createdAt }).from(users).where(gte(users.createdAt, chartSince)),
    database.select({ at: orders.createdAt }).from(orders).where(gte(orders.createdAt, chartSince)),
    database.select({ n: sql<number>`count(*)::int` }).from(waitlist),
    database.select({ n: sql<number>`count(*)::int` }).from(upgradeRequests).where(eq(upgradeRequests.status, "pending")),
    database
      .select({ n: sql<number>`count(*)::int`, stored: sql<number>`count(*) filter (where ${productImages.storageKey} is not null)::int` })
      .from(productImages),
    database
      .select({ feature: aiUsage.feature, month: sql<number>`coalesce(sum(${aiUsage.used}) filter (where ${aiUsage.period} = ${month}), 0)::int`, all: sql<number>`coalesce(sum(${aiUsage.used}), 0)::int` })
      .from(aiUsage)
      .groupBy(aiUsage.feature),
    database
      .select({ month: sql<number>`coalesce(sum(${productStudioUsage.used}) filter (where ${productStudioUsage.period} = ${month}), 0)::int`, all: sql<number>`coalesce(sum(${productStudioUsage.used}), 0)::int` })
      .from(productStudioUsage),
  ]);
  const planMix: Record<PlanId, number> = { free: 0, pro: 0, business: 0, max: 0 };
  for (const r of planRows) planMix[normalizePlan(r.plan)] += Number(r.n);
  const activePaid: Record<PlanId, number> = { free: 0, pro: 0, business: 0, max: 0 };
  for (const r of paidRows) activePaid[normalizePlan(r.plan)] += Number(r.n);
  const monthly = Object.fromEntries(PLAN_IDS.map((id) => [id, id === "free" ? 0 : getPlan(id).monthly]));
  const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((st) => [st, 0])) as Record<OrderStatus, number>;
  for (const r of orderStatusRows) if (isOrderStatus(r.status)) ordersByStatus[r.status] += Number(r.n);
  return {
    period,
    days,
    since: chartSince,
    users: Number(u?.n ?? 0),
    usersVerified: Number(u?.verified ?? 0),
    usersNew: Number(u?.fresh ?? 0),
    sellers: Number(u?.sellers ?? 0),
    stores: Number(s?.n ?? 0),
    storesNew: Number(s?.fresh ?? 0),
    storesByStatus: { live: Number(s?.live ?? 0), unpublished: Number(s?.unpublished ?? 0), suspended: Number(s?.suspended ?? 0), featured: Number(s?.featured ?? 0) },
    liveStores: Number(s?.live ?? 0),
    products: Number(p?.n ?? 0),
    productsActive: Number(p?.active ?? 0),
    productsHidden: Number(p?.hidden ?? 0),
    orders: Number(o?.n ?? 0),
    ordersInPeriod: Number(o?.inPeriod ?? 0),
    ordersByStatus,
    gmv: Number(o?.gmv ?? 0),
    gmvInPeriod: Number(o?.gmvPeriod ?? 0),
    waitlist: Number(w?.n ?? 0),
    pendingUpgrades: Number(pend?.n ?? 0),
    planMix,
    activePaid,
    activePaidStores: PLAN_IDS.reduce((n, id) => n + activePaid[id], 0),
    mrrUsd: mrrEstimate(activePaid, monthly),
    usage: {
      month,
      images: Number(img?.n ?? 0),
      imagesStored: Number(img?.stored ?? 0),
      ai: aiRows.map((r) => ({ feature: r.feature, month: Number(r.month), all: Number(r.all) })),
      studioMonth: Number(studio?.month ?? 0),
      studioAll: Number(studio?.all ?? 0),
    },
    signups: dailySeries(signupRows.map((r) => r.at), days, now),
    ordersDaily: dailySeries(orderRows.map((r) => r.at), days, now),
  };
}

/** Exact row count of the waitlist (the list itself is capped for display). */
export async function waitlistCount(database: Db): Promise<{ n: number; refs: number }> {
  const [r] = await database.select({ n: sql<number>`count(*)::int`, refs: sql<number>`coalesce(sum(${waitlist.referralCount}), 0)::int` }).from(waitlist);
  return { n: Number(r?.n ?? 0), refs: Number(r?.refs ?? 0) };
}

/** Top waitlist cities over the whole table. */
export async function waitlistCities(database: Db, limit = 6) {
  return database.select({ city: waitlist.city, n: sql<number>`count(*)::int` }).from(waitlist).groupBy(waitlist.city).orderBy(desc(sql`count(*)`)).limit(limit);
}

// ---------------------------------------------------------------- users
export type UserFilter = { q?: string; status?: UserStatus | "all"; role?: PlatformRole | "all"; page?: number };

export async function listUsers(database: Db, f: UserFilter = {}) {
  const where: SQL[] = [];
  if (f.q) where.push(or(ilike(users.email, like(f.q)), ilike(users.name, like(f.q)), ilike(users.phone, like(f.q)))!);
  if (f.status && f.status !== "all") where.push(eq(users.status, f.status));
  if (f.role && f.role !== "all") where.push(eq(users.role, f.role));
  const cond = where.length ? and(...where) : undefined;
  const page = pageOf(f.page);
  const storeCount = sql<number>`(select count(*)::int from ${stores} where ${stores.ownerId} = ${users.id})`;
  const [rows, [c]] = await Promise.all([
    database
      .select({ id: users.id, email: users.email, name: users.name, phone: users.phone, role: users.role, status: users.status, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt, storeCount })
      .from(users)
      .where(cond)
      .orderBy(desc(users.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    database.select({ n: sql<number>`count(*)::int` }).from(users).where(cond),
  ]);
  return { rows, total: Number(c?.n ?? 0), page, size: ADMIN_PAGE_SIZE };
}

export async function getUserDetail(database: Db, id: string) {
  const u = await database.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, email: true, name: true, phone: true, role: true, status: true, locale: true, emailVerifiedAt: true, createdAt: true, updatedAt: true },
  });
  if (!u) return null;
  const [owned, memberships, sess] = await Promise.all([
    database.select({ id: stores.id, name: stores.name, slug: stores.slug, plan: stores.plan, isActive: stores.isActive, suspendedAt: stores.suspendedAt }).from(stores).where(eq(stores.ownerId, id)),
    database.select({ storeId: storeMembers.storeId, name: stores.name, slug: stores.slug }).from(storeMembers).innerJoin(stores, eq(stores.id, storeMembers.storeId)).where(eq(storeMembers.userId, id)),
    database
      .select({ id: sessions.id, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, ip: sessions.ip, userAgent: sessions.userAgent, impersonatedBy: sessions.impersonatedBy })
      .from(sessions)
      .where(and(eq(sessions.userId, id), gte(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt))
      .limit(20),
  ]);
  // Session ids are sha256 hashes; only a short prefix ever leaves the server.
  return { user: u, owned, memberships, sessions: sess.map((s) => ({ ...s, id: s.id.slice(0, 10) })) };
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function cleanUserPatch(raw: { name?: unknown; email?: unknown; phone?: unknown }) {
  const patch: { name?: string; email?: string; phone?: string | null } = {};
  if (raw.name !== undefined) {
    const n = String(raw.name).trim();
    if (n.length < 1 || n.length > 120) throw new AppError("VALIDATION", "name_required");
    patch.name = n;
  }
  if (raw.email !== undefined) {
    const e = String(raw.email).trim().toLowerCase();
    if (!EMAIL_RE.test(e)) throw new AppError("VALIDATION", "invalid_email");
    patch.email = e;
  }
  if (raw.phone !== undefined) {
    const p = String(raw.phone).replace(/[\s-]/g, "");
    if (p && !/^\+?\d{7,15}$/.test(p)) throw new AppError("VALIDATION", "invalid_phone");
    patch.phone = p || null;
  }
  return patch;
}

export async function updateUser(database: Db, id: string, raw: { name?: unknown; email?: unknown; phone?: unknown }) {
  const before = await database.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, name: true, email: true, phone: true } });
  if (!before) throw new AppError("NOT_FOUND");
  const patch = cleanUserPatch(raw);
  if (patch.email && patch.email !== before.email) {
    const taken = await database.query.users.findFirst({ where: and(eq(users.email, patch.email), ne(users.id, id)), columns: { id: true } });
    if (taken) throw new AppError("CONFLICT", "email_taken");
  }
  const [after] = await database.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id, name: users.name, email: users.email, phone: users.phone });
  return { before, after: after! };
}

export async function setEmailVerified(database: Db, id: string, verified: boolean) {
  const before = await database.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true, emailVerifiedAt: true } });
  if (!before) throw new AppError("NOT_FOUND");
  await database.update(users).set({ emailVerifiedAt: verified ? new Date() : null }).where(eq(users.id, id));
  return { before, after: { ...before, emailVerifiedAt: verified ? new Date() : null } };
}

export async function revokeSessions(database: Db, userId: string): Promise<number> {
  const rows = await database.delete(sessions).where(eq(sessions.userId, userId)).returning({ id: sessions.id });
  return rows.length;
}

export async function setUserStatus(database: Db, id: string, status: UserStatus) {
  const before = await database.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true, status: true, role: true } });
  if (!before) throw new AppError("NOT_FOUND");
  await database.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id));
  if (status !== "active") await revokeSessions(database, id);
  return { before, after: { ...before, status } };
}

export async function setUserRole(database: Db, id: string, role: PlatformRole) {
  const before = await database.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true, role: true } });
  if (!before) throw new AppError("NOT_FOUND");
  await database.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
  return { before, after: { ...before, role } };
}

/** Deletes the user; their stores (and everything in them) cascade. Returns the slugs to drop from caches. */
export async function deleteUser(database: Db, id: string) {
  const before = await database.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true, name: true, role: true } });
  if (!before) throw new AppError("NOT_FOUND");
  const owned = await database.select({ id: stores.id, slug: stores.slug }).from(stores).where(eq(stores.ownerId, id));
  await database.delete(users).where(eq(users.id, id));
  return { before, stores: owned };
}

export async function listAdmins(database: Db, envEmails: Set<string>) {
  const rows = await database
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status, createdAt: users.createdAt })
    .from(users)
    .where(or(inArray(users.role, ["admin", "owner"]), envEmails.size ? inArray(users.email, [...envEmails]) : sql`false`))
    .orderBy(asc(users.email));
  return rows.map((r) => ({ ...r, fromEnv: envEmails.has(r.email.toLowerCase()) }));
}

export async function findUserByEmail(database: Db, email: string) {
  return database.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()), columns: { id: true, email: true, name: true, role: true, status: true } });
}

// ---------------------------------------------------------------- stores
export type StoreFilter = { q?: string; plan?: PlanId | "all"; state?: "all" | "live" | "suspended" | "unpublished" | "featured"; page?: number };

export async function listStores(database: Db, f: StoreFilter = {}) {
  const where: SQL[] = [];
  if (f.q) where.push(or(ilike(stores.name, like(f.q)), ilike(stores.slug, like(f.q)), ilike(users.email, like(f.q)))!);
  if (f.plan && f.plan !== "all") where.push(eq(stores.plan, f.plan));
  if (f.state === "live") where.push(and(eq(stores.isActive, true), isNull(stores.suspendedAt))!);
  if (f.state === "suspended") where.push(isNotNull(stores.suspendedAt));
  if (f.state === "unpublished") where.push(eq(stores.isActive, false));
  if (f.state === "featured") where.push(eq(stores.featured, true));
  const cond = where.length ? and(...where) : undefined;
  const page = pageOf(f.page);
  const productCount = sql<number>`(select count(*)::int from ${products} where ${products.storeId} = ${stores.id})`;
  const orderCount = sql<number>`(select count(*)::int from ${orders} where ${orders.storeId} = ${stores.id})`;
  const [rows, [c]] = await Promise.all([
    database
      .select({
        id: stores.id, name: stores.name, slug: stores.slug, plan: stores.plan, planPeriodEnd: stores.planPeriodEnd, isActive: stores.isActive,
        suspendedAt: stores.suspendedAt, featured: stores.featured, showcaseOptIn: stores.showcaseOptIn, createdAt: stores.createdAt,
        ownerId: stores.ownerId, ownerEmail: users.email, productCount, orderCount,
      })
      .from(stores)
      .innerJoin(users, eq(users.id, stores.ownerId))
      .where(cond)
      .orderBy(desc(stores.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    database.select({ n: sql<number>`count(*)::int` }).from(stores).innerJoin(users, eq(users.id, stores.ownerId)).where(cond),
  ]);
  return { rows, total: Number(c?.n ?? 0), page, size: ADMIN_PAGE_SIZE };
}

export async function getStoreDetail(database: Db, id: string) {
  const s = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!s) return null;
  const [owner, override, history, [counts]] = await Promise.all([
    database.query.users.findFirst({ where: eq(users.id, s.ownerId), columns: { id: true, email: true, name: true } }),
    database.query.storeLimitOverrides.findFirst({ where: eq(storeLimitOverrides.storeId, id) }),
    database.select().from(storePlanHistory).where(eq(storePlanHistory.storeId, id)).orderBy(desc(storePlanHistory.createdAt)).limit(10),
    database
      .select({
        products: sql<number>`(select count(*)::int from ${products} where ${products.storeId} = ${id})`,
        orders: sql<number>`(select count(*)::int from ${orders} where ${orders.storeId} = ${id})`,
        members: sql<number>`(select count(*)::int from ${storeMembers} where ${storeMembers.storeId} = ${id})`,
      })
      .from(sql`(select 1) as one`),
  ]);
  return { store: s, owner: owner ?? null, override: override ?? null, history, counts: counts ?? { products: 0, orders: 0, members: 0 } };
}

const STORE_EDITABLE = ["name", "slug", "phone", "whatsapp", "instagram", "city", "showcaseOptIn", "whiteLabel", "isActive", "featured"] as const;
export type StoreEdit = Partial<Record<(typeof STORE_EDITABLE)[number], unknown>>;

export function cleanStorePatch(raw: StoreEdit) {
  const patch: Partial<typeof stores.$inferInsert> = {};
  for (const k of STORE_EDITABLE) {
    if (raw[k] === undefined) continue;
    const v = raw[k];
    if (k === "showcaseOptIn" || k === "whiteLabel" || k === "isActive" || k === "featured") {
      patch[k] = v === true || v === "true" || v === "on";
    } else if (k === "name") {
      const n = String(v).trim();
      if (n.length < 2 || n.length > 80) throw new AppError("VALIDATION", "name_required");
      patch.name = n;
    } else if (k === "slug") {
      const s = String(v).trim().toLowerCase();
      if (!isValidSlug(s)) throw new AppError("VALIDATION", "invalid_slug");
      patch.slug = s;
    } else {
      const s = String(v ?? "").trim().slice(0, 120);
      patch[k] = s || null;
    }
  }
  return patch;
}

export async function updateStoreAdmin(database: Db, id: string, raw: StoreEdit) {
  const before = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!before) throw new AppError("NOT_FOUND");
  const patch = cleanStorePatch(raw);
  if (patch.slug && patch.slug !== before.slug) {
    const taken = await database.query.stores.findFirst({ where: and(eq(stores.slug, patch.slug), ne(stores.id, id)), columns: { id: true } });
    if (taken) throw new AppError("CONFLICT", "slug_taken");
  }
  const [after] = await database.update(stores).set({ ...patch, updatedAt: new Date() }).where(eq(stores.id, id)).returning();
  return { before: pickStore(before), after: pickStore(after!), slugs: [before.slug, after!.slug] };
}

function pickStore(s: typeof stores.$inferSelect) {
  return {
    name: s.name, slug: s.slug, phone: s.phone, whatsapp: s.whatsapp, instagram: s.instagram, city: s.city, plan: s.plan, planPeriodEnd: s.planPeriodEnd,
    isActive: s.isActive, suspendedAt: s.suspendedAt, suspendedReason: s.suspendedReason, featured: s.featured, showcaseOptIn: s.showcaseOptIn,
    whiteLabel: s.whiteLabel, ownerId: s.ownerId, themePreset: s.themePreset,
  };
}

/** Manually set a store's plan: comp/grant/extend. `periodEnd` null keeps a paid plan open-ended (comped). */
export async function setStorePlan(database: Db, id: string, plan: PlanId, periodEnd: Date | null, reason: string) {
  const before = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!before) throw new AppError("NOT_FOUND");
  if (periodEnd && Number.isNaN(periodEnd.getTime())) throw new AppError("VALIDATION", "invalid_date");
  const end = plan === "free" ? null : periodEnd;
  await database.transaction(async (tx) => {
    await tx.update(stores).set({ plan, planPeriodEnd: end, updatedAt: new Date() }).where(eq(stores.id, id));
    await tx.insert(storePlanHistory).values({ storeId: id, fromPlan: before.plan, toPlan: plan, periodEnd: end, reason: `admin:${reason}`.slice(0, 60) });
  });
  return { before: { plan: before.plan, planPeriodEnd: before.planPeriodEnd }, after: { plan, planPeriodEnd: end }, slug: before.slug };
}

export async function setStoreSuspended(database: Db, id: string, suspended: boolean, reason: string | null) {
  const before = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!before) throw new AppError("NOT_FOUND");
  const suspendedAt = suspended ? new Date() : null;
  await database.update(stores).set({ suspendedAt, suspendedReason: suspended ? (reason ?? "").slice(0, 300) || null : null, updatedAt: new Date() }).where(eq(stores.id, id));
  return { before: { suspendedAt: before.suspendedAt, suspendedReason: before.suspendedReason }, after: { suspendedAt, suspendedReason: suspended ? reason : null }, slug: before.slug };
}

export async function transferStore(database: Db, id: string, newOwnerEmail: string) {
  const before = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!before) throw new AppError("NOT_FOUND");
  const to = await findUserByEmail(database, newOwnerEmail);
  if (!to) throw new AppError("NOT_FOUND", "user_not_found");
  if (to.id === before.ownerId) throw new AppError("VALIDATION", "same_owner");
  await database.transaction(async (tx) => {
    await tx.update(stores).set({ ownerId: to.id, updatedAt: new Date() }).where(eq(stores.id, id));
    // The new owner must not also linger as staff of their own store.
    await tx.delete(storeMembers).where(and(eq(storeMembers.storeId, id), eq(storeMembers.userId, to.id)));
  });
  return { before: { ownerId: before.ownerId }, after: { ownerId: to.id, ownerEmail: to.email }, slug: before.slug };
}

export async function resetStoreTheme(database: Db, id: string) {
  const before = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!before) throw new AppError("NOT_FOUND");
  await database.update(stores).set({ themePreset: "bazaar", accentColor: null, themeDraft: null, themePublished: null, updatedAt: new Date() }).where(eq(stores.id, id));
  return { before: { themePreset: before.themePreset, accentColor: before.accentColor, hadPublishedTheme: before.themePublished != null }, after: { themePreset: "bazaar", accentColor: null, hadPublishedTheme: false }, slug: before.slug };
}

export async function deleteStoreAdmin(database: Db, id: string) {
  const before = await database.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!before) throw new AppError("NOT_FOUND");
  await database.delete(stores).where(eq(stores.id, id));
  return { before: pickStore(before), slug: before.slug };
}

// ---------------------------------------------------------------- limit overrides
export async function getOverride(database: Db, storeId: string) {
  return (await database.query.storeLimitOverrides.findFirst({ where: eq(storeLimitOverrides.storeId, storeId) })) ?? null;
}

export async function setOverride(database: Db, storeId: string, values: Partial<Record<LimitKey, number | null>>, note: string | null, by: string | null) {
  const st = await database.query.stores.findFirst({ where: eq(stores.id, storeId), columns: { id: true, slug: true, name: true } });
  if (!st) throw new AppError("NOT_FOUND");
  const before = await getOverride(database, storeId);
  const row = Object.fromEntries(LIMIT_KEYS.map((k) => [k, values[k] ?? null])) as Record<LimitKey, number | null>;
  const empty = LIMIT_KEYS.every((k) => row[k] === null);
  if (empty) await database.delete(storeLimitOverrides).where(eq(storeLimitOverrides.storeId, storeId));
  else
    await database
      .insert(storeLimitOverrides)
      .values({ storeId, ...row, note: note?.slice(0, 300) || null, updatedBy: by, updatedAt: new Date() })
      .onConflictDoUpdate({ target: storeLimitOverrides.storeId, set: { ...row, note: note?.slice(0, 300) || null, updatedBy: by, updatedAt: new Date() } });
  return { before, after: empty ? null : row, store: st };
}

export async function listOverrides(database: Db) {
  return database
    .select({ o: storeLimitOverrides, name: stores.name, slug: stores.slug, plan: stores.plan })
    .from(storeLimitOverrides)
    .innerJoin(stores, eq(stores.id, storeLimitOverrides.storeId))
    .orderBy(desc(storeLimitOverrides.updatedAt))
    .limit(200);
}

// ---------------------------------------------------------------- moderation
export type ProductFilter = { q?: string; state?: "all" | "hidden" | "visible"; page?: number };

export async function listAllProducts(database: Db, f: ProductFilter = {}) {
  const where: SQL[] = [];
  if (f.q) where.push(or(sql`${products.name}::text ilike ${like(f.q)}`, ilike(stores.name, like(f.q)), ilike(stores.slug, like(f.q)), ilike(products.shortCode, like(f.q)))!);
  if (f.state === "hidden") where.push(isNotNull(products.hiddenByAdminAt));
  if (f.state === "visible") where.push(isNull(products.hiddenByAdminAt));
  const cond = where.length ? and(...where) : undefined;
  const page = pageOf(f.page);
  const [rows, [c]] = await Promise.all([
    database
      .select({ id: products.id, name: products.name, price: products.price, stock: products.stock, isActive: products.isActive, hiddenByAdminAt: products.hiddenByAdminAt, shortCode: products.shortCode, createdAt: products.createdAt, storeId: stores.id, storeName: stores.name, storeSlug: stores.slug })
      .from(products)
      .innerJoin(stores, eq(stores.id, products.storeId))
      .where(cond)
      .orderBy(desc(products.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    database.select({ n: sql<number>`count(*)::int` }).from(products).innerJoin(stores, eq(stores.id, products.storeId)).where(cond),
  ]);
  return { rows, total: Number(c?.n ?? 0), page, size: ADMIN_PAGE_SIZE };
}

export async function setProductHidden(database: Db, id: string, hidden: boolean) {
  const before = await database.query.products.findFirst({ where: eq(products.id, id), columns: { id: true, storeId: true, name: true, hiddenByAdminAt: true } });
  if (!before) throw new AppError("NOT_FOUND");
  const at = hidden ? new Date() : null;
  await database.update(products).set({ hiddenByAdminAt: at, updatedAt: new Date() }).where(eq(products.id, id));
  return { before, after: { ...before, hiddenByAdminAt: at } };
}

export async function deleteProductAdmin(database: Db, id: string) {
  const before = await database.query.products.findFirst({ where: eq(products.id, id), columns: { id: true, storeId: true, name: true, price: true } });
  if (!before) throw new AppError("NOT_FOUND");
  await database.delete(products).where(eq(products.id, id));
  return { before };
}

export type OrderFilter = { q?: string; status?: OrderStatus | "all"; page?: number; limit?: number };

export async function listAllOrders(database: Db, f: OrderFilter = {}) {
  const where: SQL[] = [];
  if (f.q) where.push(or(ilike(orders.publicId, like(f.q)), ilike(orders.customerName, like(f.q)), ilike(orders.customerPhone, like(f.q)), ilike(stores.name, like(f.q)), ilike(stores.slug, like(f.q)))!);
  if (f.status && f.status !== "all" && isOrderStatus(f.status)) where.push(eq(orders.status, f.status));
  const cond = where.length ? and(...where) : undefined;
  const page = pageOf(f.page);
  const size = Math.min(f.limit ?? ADMIN_PAGE_SIZE, 5000);
  const [rows, [c]] = await Promise.all([
    database
      .select({ id: orders.id, publicId: orders.publicId, number: orders.number, status: orders.status, total: orders.total, paymentMethod: orders.paymentMethod, paymentStatus: orders.paymentStatus, customerName: orders.customerName, customerPhone: orders.customerPhone, cityName: orders.cityName, createdAt: orders.createdAt, storeId: stores.id, storeName: stores.name, storeSlug: stores.slug })
      .from(orders)
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(cond)
      .orderBy(desc(orders.createdAt))
      .limit(size)
      .offset((page - 1) * size),
    database.select({ n: sql<number>`count(*)::int` }).from(orders).innerJoin(stores, eq(stores.id, orders.storeId)).where(cond),
  ]);
  return { rows, total: Number(c?.n ?? 0), page, size };
}

// ---------------------------------------------------------------- waitlist / demand
export async function listWaitlist(database: Db, q = "", limit = 500) {
  const cond = q ? or(ilike(waitlist.name, like(q)), ilike(waitlist.whatsapp, like(q)), ilike(waitlist.city, like(q)), ilike(waitlist.sells, like(q))) : undefined;
  return database.select().from(waitlist).where(cond).orderBy(desc(waitlist.referralCount), asc(waitlist.seq)).limit(Math.min(limit, 5000));
}

// ---------------------------------------------------------------- palette search
export async function paletteSearch(database: Db, q: string) {
  const t = q.trim();
  if (t.length < 2) return [];
  const [u, s] = await Promise.all([
    database.select({ id: users.id, label: users.email, sub: users.name }).from(users).where(or(ilike(users.email, like(t)), ilike(users.name, like(t)))).limit(6),
    database.select({ id: stores.id, label: stores.name, sub: stores.slug }).from(stores).where(or(ilike(stores.name, like(t)), ilike(stores.slug, like(t)))).limit(6),
  ]);
  return [...u.map((r) => ({ kind: "user" as const, ...r })), ...s.map((r) => ({ kind: "store" as const, ...r }))];
}
