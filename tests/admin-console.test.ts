import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

// ---- Next request scope, faked: one cookie jar + request headers the guard and actions read.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "vitest-admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); },
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT;${to}`), { digest: `NEXT_REDIRECT;replace;${to};307;` }); },
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));

import type { Db } from "@/server/db";
import { adminAudit, sessions, stores, users } from "@/server/db/schema";
import { authenticate, createSession, validateSession } from "@/server/auth/service";
import { sha256 } from "@/server/auth/tokens";
import * as actions from "@/server/actions/admin";
import { currentAdmin, requireAdmin } from "@/server/auth/admin";
import { getProductUsage } from "@/server/services/catalog";
import { getAiUsage } from "@/server/services/ai-quota";
import { teamUsage } from "@/server/services/team";
import { ownedStoreUsage } from "@/server/services/store-access";
import { loadStorefrontStore } from "@/server/services/storefront";
import { clearSettingsCache, flagOn, getAnnouncement, getMaintenance } from "@/server/services/platform-settings";
import { maintenanceFor } from "@/server/admin/site-gate";
import { GET as exportGet } from "@/app/api/admin/export/[kind]/route";
import DbPage from "@/app/admin/database/page";
import DbTablePage from "@/app/admin/database/[table]/page";
import { overviewKpis } from "@/server/admin/service";
import { browseTable, listDbTables } from "@/server/admin/db-browser";
import { promoteSeedAdmins } from "../scripts/seed-admin";
import {
  MASK, applyOverride, auditSnapshot, browserCell, can, isSecretColumn, csvCell, effectiveRole, maintenanceExempt, parseAnnouncement, parseLimit, resolveFlags, stepUpMatches,
} from "@/lib/admin";
import { seller, testDb } from "./support/db";

let database: Db;
let plain: Awaited<ReturnType<typeof seller>>;
let adminUser: Awaited<ReturnType<typeof seller>>;
let ownerUser: Awaited<ReturnType<typeof seller>>;

async function signInAs(userId: string | null) {
  jar.clear();
  if (!userId) return;
  const { token } = await createSession(database, userId, 30);
  jar.set("mm_session", token);
}
const audits = async () => database.select().from(adminAudit);

beforeAll(async () => {
  database = await testDb();
  plain = await seller(database, "plain");
  adminUser = await seller(database, "adm");
  ownerUser = await seller(database, "own");
  await database.update(users).set({ role: "admin" }).where(eq(users.id, adminUser.user.id));
  await database.update(users).set({ role: "owner" }).where(eq(users.id, ownerUser.user.id));
});
beforeEach(() => clearSettingsCache());

describe("admin rules (src/lib/admin.ts)", () => {
  it("roles: ADMIN_EMAILS means owner, DB role otherwise, suspended means nothing", () => {
    expect(effectiveRole({ email: "Boss@x.iq", role: "user" }, "boss@x.iq, other@x.iq")).toBe("owner");
    expect(effectiveRole({ email: "a@x.iq", role: "admin" }, "")).toBe("admin");
    expect(effectiveRole({ email: "a@x.iq", role: "admin", status: "suspended" }, "")).toBe("user");
    expect(effectiveRole({ email: "boss@x.iq", role: "owner", status: "banned" }, "boss@x.iq")).toBe("user");
    expect(can("admin", "destructive")).toBe(true);
    expect(can("admin", "team")).toBe(false);
    expect(can("owner", "team")).toBe(true);
    expect(can("user", "read")).toBe(false);
  });
  it("step-up matches the typed name case/space-insensitively, never an empty expectation", () => {
    expect(stepUpMatches("Hawler Bazaar", "  hawler   bazaar ")).toBe(true);
    expect(stepUpMatches("shop", "shop2")).toBe(false);
    expect(stepUpMatches("", "")).toBe(false);
    expect(stepUpMatches("x", undefined)).toBe(false);
  });
  it("flags default on; only booleans override", () => {
    expect(resolveFlags(null).signups).toBe(true);
    expect(resolveFlags({ signups: false, waitlist: "no" })).toMatchObject({ signups: false, waitlist: true });
  });
  it("announcement needs text, a known tone and a safe link", () => {
    expect(parseAnnouncement({ on: true, text: {} }).on).toBe(false);
    const a = parseAnnouncement({ on: true, tone: "nope", text: { en: "Hi" }, href: "javascript:alert(1)" });
    expect(a).toMatchObject({ on: true, tone: "blue" });
    expect(a.href).toBeUndefined();
  });
  it("overrides: empty = plan default, 0 is a real limit, junk is rejected", () => {
    expect(applyOverride(10, null)).toBe(10);
    expect(applyOverride(10, 0)).toBe(0);
    expect(applyOverride(10, 500)).toBe(500);
    expect(parseLimit("")).toBeNull();
    expect(parseLimit("12")).toBe(12);
    expect(parseLimit("-1")).toBe("invalid");
    expect(parseLimit("1e3")).toBe("invalid");
  });
  it("audit snapshots redact secrets and CSV cells neutralise formulas", () => {
    expect(auditSnapshot({ passwordHash: "x", token: "y", name: "A" })).toEqual({ passwordHash: "[redacted]", token: "[redacted]", name: "A" });
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("maintenance never locks the owner out of /admin or /login", () => {
    expect(maintenanceExempt("/admin/site")).toBe(true);
    expect(maintenanceExempt("/login")).toBe(true);
    expect(maintenanceExempt("/s/shop")).toBe(false);
  });
});

describe("guard: a non-admin is refused everywhere", () => {
  const callable = Object.entries(actions).filter(([n, f]) => typeof f === "function" && n !== "endImpersonationAction") as [string, (...a: unknown[]) => Promise<unknown>][];

  it("finds every admin action", () => {
    expect(callable.length).toBeGreaterThanOrEqual(20);
  });

  it.each([["signed out", null], ["plain seller", "plain"]] as const)("%s: every action → FORBIDDEN, nothing written", async (_label, who) => {
    await signInAs(who ? plain.user.id : null);
    const before = (await audits()).length;
    const target = { id: plain.user.id, storeId: plain.store.id, status: "banned", role: "owner", plan: "max", flag: "signups", on: false, hidden: true, suspended: true, decision: "activate", tone: "blue", text: { en: "x" }, email: "x@y.iq", confirm: "x", featured: true };
    for (const [name, fn] of callable) {
      const res = await fn(name === "adminPaletteSearchAction" ? "plain" : target);
      if (name === "adminPaletteSearchAction") expect(res, name).toEqual([]);
      else expect((res as { ok: boolean; error: string }).error, name).toMatch(/^(FORBIDDEN|admin_only)$/);
    }
    expect((await audits()).length).toBe(before);
    const u = await database.query.users.findFirst({ where: eq(users.id, plain.user.id) });
    expect(u?.status).toBe("active");
    expect(u?.role).toBe("user");
  });

  it("pages: requireAdmin 404s a seller and passes an admin", async () => {
    await signInAs(plain.user.id);
    await expect(requireAdmin()).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_HTTP_ERROR_FALLBACK;404/) });
    await signInAs(null);
    await expect(requireAdmin()).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_REDIRECT/) });
    await signInAs(adminUser.user.id);
    await expect(requireAdmin()).resolves.toMatchObject({ id: adminUser.user.id, role: "admin" });
    await expect(requireAdmin("team")).rejects.toBeTruthy();
  });

  it("CSV export route: 404 for a seller, CSV for an admin (and audited)", async () => {
    await signInAs(plain.user.id);
    const r = await exportGet(new Request("http://x/api/admin/export/users"), { params: Promise.resolve({ kind: "users" }) });
    expect(r.status).toBe(404);
    await signInAs(adminUser.user.id);
    const ok = await exportGet(new Request("http://x/api/admin/export/users"), { params: Promise.resolve({ kind: "users" }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("text/csv");
    expect(await ok.text()).toContain(plain.user.email);
    expect((await audits()).some((a) => a.action === "export.csv")).toBe(true);
  });

  it("every /admin page and route calls the guard itself (static check)", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/^(page|route)\.tsx?$/.test(n)) out.push(p); }
      return out;
    };
    const files = [...walk("src/app/admin"), ...walk("src/app/api/admin")];
    expect(files.length).toBeGreaterThanOrEqual(11);
    for (const f of files) expect(/requireAdmin\(|currentAdmin\(\)/.test(readFileSync(f, "utf8")), f).toBe(true);
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    expect(layout).toMatch(/requireAdmin\(\)/);
    expect(layout).toMatch(/index: false/);
    // Every exported action goes through run() or the guard directly.
    const src = readFileSync("src/server/actions/admin.ts", "utf8");
    for (const m of src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) {
      if (m[1] === "endImpersonationAction") continue;
      expect(/return run\(|requireAdminAction\(/.test(m[2]!), m[1]).toBe(true);
    }
  });
});

describe("admin actions", () => {
  it("edit a user: audited with who, before/after, IP and user agent", async () => {
    await signInAs(adminUser.user.id);
    const res = await actions.adminUpdateUserAction({ id: plain.user.id, name: "Renamed Seller" });
    expect(res.ok).toBe(true);
    const row = (await audits()).find((a) => a.action === "user.update");
    expect(row).toMatchObject({ actorEmail: adminUser.user.email, targetType: "user", targetId: plain.user.id, ip: "203.0.113.7", userAgent: "vitest-admin" });
    expect(row?.before).toMatchObject({ name: plain.user.name });
    expect(row?.after).toMatchObject({ name: "Renamed Seller" });
  });

  it("suspend needs step-up; then sessions die and sign-in fails; reactivate restores", async () => {
    const victim = await seller(database, "victim");
    const { token } = await createSession(database, victim.user.id, 30);
    await signInAs(adminUser.user.id);
    expect(await actions.adminSetUserStatusAction({ id: victim.user.id, status: "suspended", confirm: "wrong" })).toMatchObject({ ok: false, error: "step_up_failed" });
    expect(await actions.adminSetUserStatusAction({ id: victim.user.id, status: "suspended", password: "not it" })).toMatchObject({ ok: false, error: "step_up_failed" });
    expect(await actions.adminSetUserStatusAction({ id: victim.user.id, status: "suspended", password: "correct horse battery" })).toMatchObject({ ok: true });
    expect(await validateSession(database, token, 30)).toBeNull();
    await expect(authenticate(database, victim.user.email, "correct horse battery")).rejects.toMatchObject({ message: "invalid_credentials" });
    expect(await actions.adminSetUserStatusAction({ id: victim.user.id, status: "active" })).toMatchObject({ ok: true });
    await expect(authenticate(database, victim.user.email, "correct horse battery")).resolves.toMatchObject({ id: victim.user.id });
    expect((await audits()).filter((a) => a.targetId === victim.user.id).map((a) => a.action)).toEqual(expect.arrayContaining(["user.suspend", "user.unban"]));
  });

  it("an admin can't suspend an owner or manage the team; an owner can", async () => {
    await signInAs(adminUser.user.id);
    expect((await actions.adminSetUserStatusAction({ id: ownerUser.user.id, status: "banned", confirm: ownerUser.user.email })).ok).toBe(false);
    expect(await actions.adminSetRoleAction({ id: plain.user.id, role: "admin" })).toMatchObject({ ok: false });
    await signInAs(ownerUser.user.id);
    expect(await actions.adminSetRoleAction({ email: plain.user.email, role: "admin" })).toMatchObject({ ok: true });
    expect(await actions.adminSetRoleAction({ id: plain.user.id, role: "user" })).toMatchObject({ ok: true });
    expect(await actions.adminSetRoleAction({ id: ownerUser.user.id, role: "user" })).toMatchObject({ ok: false, error: "not_on_self" });
  });

  it("delete a throwaway user with step-up removes the account and its store", async () => {
    const temp = await seller(database, "temp");
    await signInAs(adminUser.user.id);
    expect((await actions.adminDeleteUserAction({ id: temp.user.id })).ok).toBe(false);
    expect(await actions.adminDeleteUserAction({ id: temp.user.id, confirm: temp.user.email.toUpperCase() })).toMatchObject({ ok: true });
    expect(await database.query.users.findFirst({ where: eq(users.id, temp.user.id) })).toBeUndefined();
    expect(await database.query.stores.findFirst({ where: eq(stores.id, temp.store.id) })).toBeUndefined();
  });

  it("suspend a store: storefront sees suspendedAt; lift it again", async () => {
    const s = await seller(database, "susp");
    await signInAs(adminUser.user.id);
    expect((await actions.adminSuspendStoreAction({ id: s.store.id, suspended: true, reason: "test" })).ok).toBe(false);
    expect(await actions.adminSuspendStoreAction({ id: s.store.id, suspended: true, reason: "test", confirm: s.store.slug })).toMatchObject({ ok: true });
    expect((await loadStorefrontStore(database, s.store.slug))?.suspendedAt).toBeInstanceOf(Date);
    expect(await actions.adminSuspendStoreAction({ id: s.store.id, suspended: false })).toMatchObject({ ok: true });
    expect((await loadStorefrontStore(database, s.store.slug))?.suspendedAt).toBeNull();
  });

  it("plan grant/extend/comp writes plan history", async () => {
    const s = await seller(database, "plan");
    await signInAs(adminUser.user.id);
    expect(await actions.adminSetPlanAction({ id: s.store.id, plan: "pro", months: 1, reason: "grant" })).toMatchObject({ ok: true });
    const a = await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) });
    expect(a?.plan).toBe("pro");
    expect(a!.planPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    expect(await actions.adminSetPlanAction({ id: s.store.id, plan: "max", periodEnd: null, reason: "comp" })).toMatchObject({ ok: true });
    expect((await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) }))).toMatchObject({ plan: "max", planPeriodEnd: null });
  });

  it("limit overrides change the enforced limits, and clearing restores the plan", async () => {
    const s = await seller(database, "lim");
    await signInAs(adminUser.user.id);
    expect((await getProductUsage(database, s.store.id)).cap).toBe(10);
    expect(await actions.adminSetOverrideAction({ storeId: s.store.id, products: "2", aiCredits: "7", seats: "4", stores: "3" })).toMatchObject({ ok: true });
    expect((await getProductUsage(database, s.store.id)).cap).toBe(2);
    expect((await getAiUsage(database, s.store.id, "aiDescriptions")).limit).toBe(7);
    expect((await teamUsage(database, s.store.id)).limit).toBe(4);
    expect((await ownedStoreUsage(database, s.user.id)).limit).toBe(3);
    expect(await actions.adminSetOverrideAction({ storeId: s.store.id, products: "abc" })).toMatchObject({ ok: false, error: "invalid_limit" });
    expect(await actions.adminSetOverrideAction({ storeId: s.store.id })).toMatchObject({ ok: true });
    expect((await getProductUsage(database, s.store.id)).cap).toBe(10);
  });

  it("feature flags flip at runtime", async () => {
    await signInAs(adminUser.user.id);
    expect(await flagOn(database, "signups")).toBe(true);
    expect(await actions.adminSetFlagAction({ flag: "signups", on: false })).toMatchObject({ ok: true });
    expect(await flagOn(database, "signups")).toBe(false);
    expect((await actions.adminSetFlagAction({ flag: "nope", on: false })).ok).toBe(false);
    await actions.adminSetFlagAction({ flag: "signups", on: true });
    expect(await flagOn(database, "signups")).toBe(true);
  });

  it("maintenance mode: step-up to switch on, sellers blocked, admins bypass", async () => {
    await signInAs(adminUser.user.id);
    expect((await actions.adminSetMaintenanceAction({ on: true })).ok).toBe(false);
    expect(await actions.adminSetMaintenanceAction({ on: true, message: "Back at 9", confirm: "maintenance" })).toMatchObject({ ok: true });
    expect(await getMaintenance(database)).toEqual({ on: true, message: "Back at 9" });
    expect(await maintenanceFor()).toBeNull(); // admin bypass
    await signInAs(plain.user.id);
    expect(await maintenanceFor()).toEqual({ message: "Back at 9" });
    await signInAs(null);
    expect(await maintenanceFor()).toEqual({ message: "Back at 9" });
    await signInAs(adminUser.user.id);
    expect(await actions.adminSetMaintenanceAction({ on: false })).toMatchObject({ ok: true });
    await signInAs(plain.user.id);
    expect(await maintenanceFor()).toBeNull();
  });

  it("announcement saves in 4 locales", async () => {
    await signInAs(adminUser.user.id);
    expect(await actions.adminSetAnnouncementAction({ on: true, tone: "ink", href: "/pricing", text: { en: "Sale", ku: "داشکاندن", ar: "تخفيض", kmr: "Daxistin" } })).toMatchObject({ ok: true });
    expect(await getAnnouncement(database)).toMatchObject({ on: true, tone: "ink", href: "/pricing", text: { kmr: "Daxistin" } });
  });

  it("impersonation: 30-minute view-as session, audited, never an admin session", async () => {
    await signInAs(adminUser.user.id);
    const adminToken = jar.get("mm_session")!;
    expect(await actions.adminImpersonateAction({ id: ownerUser.user.id })).toMatchObject({ ok: false });
    expect(await actions.adminImpersonateAction({ id: plain.user.id })).toMatchObject({ ok: true });
    const viewAs = jar.get("mm_session")!;
    expect(viewAs).not.toBe(adminToken);
    expect(jar.get("mm_admin_return")).toBe(adminToken);
    const s = await validateSession(database, viewAs, 30);
    expect(s).toMatchObject({ id: plain.user.id, impersonatedBy: adminUser.user.id });
    const row = await database.query.sessions.findFirst({ where: eq(sessions.id, sha256(viewAs)) });
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000 + 1000);
    expect(await currentAdmin()).toBeNull();
    expect((await audits()).some((a) => a.action === "user.impersonate" && a.targetId === plain.user.id)).toBe(true);
    await expect(actions.endImpersonationAction()).rejects.toMatchObject({ digest: expect.stringContaining("/admin/users") });
    expect(jar.get("mm_session")).toBe(adminToken);
    expect(await validateSession(database, viewAs, 30)).toBeNull();
  });

  it("SEED_ADMIN_EMAIL promotes an existing account to owner, idempotently", async () => {
    const s = await seller(database, "seed");
    expect(await promoteSeedAdmins(database, `${s.user.email.toUpperCase()}, nobody@x.iq`)).toEqual([s.user.email]);
    expect(await promoteSeedAdmins(database, s.user.email)).toEqual([]);
    expect(await promoteSeedAdmins(database, "")).toEqual([]);
    expect((await database.query.users.findFirst({ where: eq(users.id, s.user.id) }))?.role).toBe("owner");
  });
});

describe("overview + database browser: real data only", () => {
  const count = async (table: string) => Number(((await database.execute(sql`select count(*)::int as n from ${sql.identifier(table)}`)) as unknown as { rows: { n: number }[] }).rows[0]!.n);

  it("overview numbers are the database's own counts (no synthetic generator in admin code)", async () => {
    const k = await overviewKpis(database, "all");
    expect(k.users).toBe(await count("users"));
    expect(k.stores).toBe(await count("stores"));
    expect(k.products).toBe(await count("products"));
    expect(k.orders).toBe(await count("orders"));
    expect(k.waitlist).toBe(await count("waitlist"));
    expect(k.storesByStatus.live + k.storesByStatus.unpublished + k.storesByStatus.suspended).toBe(k.stores);
    expect(Object.values(k.ordersByStatus).reduce((a, b) => a + b, 0)).toBe(k.orders);
    expect(Object.values(k.planMix).reduce((a, b) => a + b, 0)).toBe(k.stores);
    expect(k.signups.reduce((a, d) => a + d.n, 0)).toBe(k.usersNew);
    expect(k.usersNew).toBe(k.users);
    expect(k.ordersInPeriod).toBe(k.orders);
    expect(k.gmvInPeriod).toBe(k.gmv);
    // MRR estimate = running paid plans (not expired, not suspended) × list price, recomputed here from raw rows.
    const paid = ((await database.execute(sql`select plan, count(*)::int as n from stores where plan <> 'free' and suspended_at is null and (plan_period_end is null or plan_period_end >= now()) group by plan`)) as unknown as { rows: { plan: string; n: number }[] }).rows;
    const price: Record<string, number> = { pro: 15, business: 50, max: 100 };
    expect(k.mrrUsd).toBe(paid.reduce((a, r) => a + (price[r.plan] ?? 0) * Number(r.n), 0));
    const k7 = await overviewKpis(database, "7d");
    expect(k7.signups).toHaveLength(7);

    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(n)) out.push(p); }
      return out;
    };
    const files = [...walk("src/app/admin"), ...walk("src/components/admin"), ...walk("src/server/admin"), "src/lib/admin.ts"];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      expect(imports.filter((i) => /seed|demo|sample|synthetic|fake|faker|mock|analytics/i.test(i)), f).toEqual([]);
      expect(/Math\.random\(/.test(src), `${f} uses Math.random`).toBe(false);
    }
  });

  it("lists every app table with its real row count", async () => {
    const tables = await listDbTables(database);
    const users_ = tables.find((x) => x.name === "users");
    expect(users_?.rows).toBe(await count("users"));
    expect(tables.find((x) => x.name === "admin_audit")).toBeTruthy();
    expect(tables.length).toBeGreaterThanOrEqual(30);
  });

  it("masks secret columns, and a search can't probe them", async () => {
    expect(isSecretColumn("users", "password_hash")).toBe(true);
    expect(isSecretColumn("sessions", "id")).toBe(true);
    expect(isSecretColumn("phone_otps", "code_hash")).toBe(true);
    expect(isSecretColumn("store_members", "token_hash")).toBe(true);
    expect(isSecretColumn("seller_payout_profiles", "account_identifier")).toBe(true);
    expect(isSecretColumn("push_subscriptions", "p256dh")).toBe(true);
    expect(isSecretColumn("users", "email")).toBe(false);
    expect(isSecretColumn("testimonials", "author")).toBe(false);
    expect(browserCell("users", "password_hash", "$argon2id$abc")).toBe(MASK);
    expect(browserCell("users", "name", null)).toBeNull();

    const u = await browseTable(database, { table: "users", q: plain.user.email });
    expect(u).not.toBeNull();
    const pw = u!.columns.findIndex((c) => c.name === "password_hash");
    const em = u!.columns.findIndex((c) => c.name === "email");
    expect(pw).toBeGreaterThanOrEqual(0);
    expect(u!.columns[pw]!.secret).toBe(true);
    expect(u!.rows.length).toBe(1);
    expect(u!.rows[0]![pw]).toBe(MASK);
    expect(u!.rows[0]![em]).toBe(plain.user.email);

    const hash = (await database.query.users.findFirst({ where: eq(users.id, plain.user.id) }))!.passwordHash;
    expect((await browseTable(database, { table: "users", q: hash.slice(0, 20) }))!.total).toBe(0);

    await createSession(database, plain.user.id, 30);
    const s = await browseTable(database, { table: "sessions" });
    const sid = s!.columns.findIndex((c) => c.name === "id");
    expect(s!.rows.length).toBeGreaterThan(0);
    expect(s!.rows.every((r) => r[sid] === MASK)).toBe(true);

    // Unknown names never reach SQL; sorting accepts only real columns.
    expect(await browseTable(database, { table: "users; drop table users" })).toBeNull();
    expect(await browseTable(database, { table: "pg_user" })).toBeNull();
    const sorted = await browseTable(database, { table: "users", sort: "email\" desc --", dir: "asc" });
    expect(sorted!.sort).toBe("created_at");
  });

  it("database browser: 404 for a seller and for a plain admin (owner only)", async () => {
    const props = { searchParams: Promise.resolve({}) };
    const tprops = { params: Promise.resolve({ table: "users" }), searchParams: Promise.resolve({}) };
    for (const who of [plain.user.id, adminUser.user.id]) {
      await signInAs(who);
      await expect(DbPage(props)).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_HTTP_ERROR_FALLBACK;404/) });
      await expect(DbTablePage(tprops)).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_HTTP_ERROR_FALLBACK;404/) });
    }
    for (const f of ["src/app/admin/database/page.tsx", "src/app/admin/database/[table]/page.tsx"]) expect(readFileSync(f, "utf8")).toMatch(/requireAdmin\("team"\)/);
  });
});

import { existsSync as __ex, readFileSync as __rf } from "node:fs";
import { it as __it, expect as __expect } from "vitest";
__it("admin has its own not-found pointing back to /admin", () => {
  __expect(__ex("src/app/admin/not-found.tsx")).toBe(true);
  __expect(__rf("src/app/admin/not-found.tsx", "utf8")).toContain('href: "/admin"');
});
