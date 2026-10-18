"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { env } from "../env";
import { AppError, isAppError } from "../errors";
import { currentUser } from "../auth/session";
import { createSession } from "../auth/service";
import { sha256 } from "../auth/tokens";
import { verifyPassword } from "../auth/password";
import { requestMeta, requireAdminAction, type AdminUser } from "../auth/admin";
import { writeAdminAudit, type AuditTarget } from "../admin/audit";
import * as svc from "../admin/service";
import { activateRequest, rejectRequest } from "../services/upgrades";
import { updateOrderStatus } from "../services/orders";
import { SETTING_KEYS, getSetting, setSetting } from "../services/platform-settings";
import { invalidateCatalog, invalidateStore } from "../cache/tags";
import { toActionState, type ActionState } from "./util";
import {
  ADMIN_RETURN_COOKIE,
  ANNOUNCE_TONES,
  FEATURE_FLAGS,
  IMPERSONATION_MINUTES,
  LIMIT_KEYS,
  PLATFORM_ROLES,
  USER_STATUSES,
  effectiveRole,
  parseAnnouncement,
  parseLimit,
  parseMaintenance,
  resolveFlags,
  stepUpMatches,
  type AdminPerm,
  type FeatureFlag,
  type LimitKey,
  type PlatformRole,
  type UserStatus,
} from "@/lib/admin";
import { PLAN_IDS, type PlanId } from "@/lib/plans";
import { isOrderStatus } from "@/lib/order-status";

type Done = { target: AuditTarget; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; data?: ActionState["data"] };

/** One admin write: guard (role + rate limit) → change → audit row → revalidate. Every exported action goes through here. */
async function run(perm: AdminPerm, action: string, fn: (admin: AdminUser) => Promise<Done>): Promise<ActionState> {
  try {
    const admin = await requireAdminAction(perm);
    const done = await fn(admin);
    const meta = await requestMeta();
    await writeAdminAudit(db(), { id: admin.id, email: admin.email }, action, done.target, done.before ?? null, done.after ?? null, meta);
    revalidatePath("/admin", "layout");
    return { ok: true, ...(done.data ? { data: done.data } : {}) };
  } catch (e) {
    return adminError(e);
  }
}

const ADMIN_ERRORS = new Set(["step_up_failed", "admin_only", "not_on_self", "user_inactive", "user_not_found", "same_owner", "invalid_limit", "announcement_text_required", "invalid_email"]);
/** Admin-specific error codes pass through (translated under admin.err.*); everything else uses the shared mapping. */
function adminError(e: unknown): ActionState {
  if (isAppError(e) && ADMIN_ERRORS.has(e.message)) return { ok: false, error: e.message };
  return toActionState(e);
}

/** Destructive step-up: the typed confirmation must equal the target's name/e-mail/slug, or be the admin's own password. */
async function stepUp(admin: AdminUser, expected: string, input: { confirm?: unknown; password?: unknown }) {
  if (stepUpMatches(expected, input.confirm)) return;
  if (typeof input.password === "string" && input.password.length > 0 && input.password.length < 200) {
    const row = await db().query.users.findFirst({ where: eq(users.id, admin.id), columns: { passwordHash: true } });
    if (row && (await verifyPassword(input.password, row.passwordHash))) return;
  }
  throw new AppError("VALIDATION", "step_up_failed");
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const isRole = (v: unknown): v is PlatformRole => (PLATFORM_ROLES as readonly string[]).includes(String(v));
const isStatus = (v: unknown): v is UserStatus => (USER_STATUSES as readonly string[]).includes(String(v));
const isPlan = (v: unknown): v is PlanId => (PLAN_IDS as readonly string[]).includes(String(v));

async function targetUser(id: string) {
  const u = await db().query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true, name: true, role: true, status: true } });
  if (!u) throw new AppError("NOT_FOUND");
  return u;
}

/** An admin can't act on someone of equal or higher rank (owners are only changed by owners), nor on themselves for lockout actions. */
function assertRank(admin: AdminUser, target: { email: string; role: string; status: string; id: string }, opts: { self?: boolean } = {}) {
  if (opts.self === false && target.id === admin.id) throw new AppError("FORBIDDEN", "not_on_self");
  const role = effectiveRole({ ...target, status: "active" }, env().ADMIN_EMAILS);
  if (role === "owner" && admin.role !== "owner") throw new AppError("FORBIDDEN", "admin_only");
  if (role === "admin" && admin.role !== "owner" && target.id !== admin.id) throw new AppError("FORBIDDEN", "admin_only");
}

// ---------------------------------------------------------------- users
export async function adminUpdateUserAction(input: { id: string; name?: string; email?: string; phone?: string }): Promise<ActionState> {
  return run("write", "user.update", async (admin) => {
    const t = await targetUser(str(input.id));
    assertRank(admin, t);
    const { before, after } = await svc.updateUser(db(), t.id, { name: input.name, email: input.email, phone: input.phone });
    return { target: { type: "user", id: t.id, label: after.email }, before, after };
  });
}

export async function adminVerifyEmailAction(input: { id: string; verified: boolean }): Promise<ActionState> {
  return run("write", input.verified ? "user.verify_email" : "user.unverify_email", async () => {
    const t = await targetUser(str(input.id));
    const { before, after } = await svc.setEmailVerified(db(), t.id, !!input.verified);
    return { target: { type: "user", id: t.id, label: t.email }, before, after };
  });
}

export async function adminRevokeSessionsAction(input: { id: string }): Promise<ActionState> {
  return run("write", "user.force_logout", async (admin) => {
    const t = await targetUser(str(input.id));
    assertRank(admin, t, { self: false });
    const n = await svc.revokeSessions(db(), t.id);
    return { target: { type: "user", id: t.id, label: t.email }, after: { sessionsRevoked: n }, data: { revoked: n } };
  });
}

export async function adminSetUserStatusAction(input: { id: string; status: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", `user.${input.status === "active" ? "unban" : input.status === "banned" ? "ban" : "suspend"}`, async (admin) => {
    if (!isStatus(input.status)) throw new AppError("VALIDATION");
    const t = await targetUser(str(input.id));
    assertRank(admin, t, { self: false });
    if (input.status !== "active") await stepUp(admin, t.email, input);
    const { before, after } = await svc.setUserStatus(db(), t.id, input.status);
    const owned = await svc.getUserDetail(db(), t.id);
    for (const s of owned?.owned ?? []) invalidateStore(s.id, [s.slug]);
    return { target: { type: "user", id: t.id, label: t.email }, before, after };
  });
}

export async function adminDeleteUserAction(input: { id: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", "user.delete", async (admin) => {
    const t = await targetUser(str(input.id));
    assertRank(admin, t, { self: false });
    await stepUp(admin, t.email, input);
    const { before, stores: gone } = await svc.deleteUser(db(), t.id);
    for (const s of gone) invalidateStore(s.id, [s.slug]);
    return { target: { type: "user", id: t.id, label: t.email }, before: { ...before, stores: gone.map((s) => s.slug).join(",") }, after: null };
  });
}

export async function adminSetRoleAction(input: { id?: string; email?: string; role: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("team", "admin.role", async (admin) => {
    if (!isRole(input.role)) throw new AppError("VALIDATION");
    const found = input.id ? await targetUser(str(input.id)) : await svc.findUserByEmail(db(), str(input.email));
    if (!found) throw new AppError("NOT_FOUND", "user_not_found");
    if (found.id === admin.id && input.role !== admin.role) throw new AppError("FORBIDDEN", "not_on_self");
    if (input.role === "owner" || found.role === "owner") await stepUp(admin, found.email, input);
    const { before, after } = await svc.setUserRole(db(), found.id, input.role);
    return { target: { type: "user", id: found.id, label: found.email }, before, after };
  });
}

/** "View as seller": a 30-minute session as the target; the admin's own session waits in an httpOnly return cookie. */
export async function adminImpersonateAction(input: { id: string }): Promise<ActionState> {
  return run("write", "user.impersonate", async (admin) => {
    const t = await targetUser(str(input.id));
    if (t.status !== "active") throw new AppError("VALIDATION", "user_inactive");
    if (effectiveRole(t, env().ADMIN_EMAILS) !== "user") throw new AppError("FORBIDDEN", "admin_only");
    const e = env();
    const jar = await cookies();
    const adminToken = jar.get(e.SESSION_COOKIE_NAME)?.value;
    if (!adminToken) throw new AppError("UNAUTHENTICATED");
    const meta = await requestMeta();
    const { token, expiresAt } = await createSession(db(), t.id, e.SESSION_TTL_DAYS, { ...meta, impersonatedBy: admin.id, ttlMinutes: IMPERSONATION_MINUTES });
    const opts = { httpOnly: true, secure: e.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: expiresAt };
    jar.set(ADMIN_RETURN_COOKIE, adminToken, opts);
    jar.set(e.SESSION_COOKIE_NAME, token, opts);
    return { target: { type: "user", id: t.id, label: t.email }, after: { expiresAt: expiresAt.toISOString(), minutes: IMPERSONATION_MINUTES } };
  });
}

/** Ends a view-as session (called from the banner, by the impersonated session itself) and restores the admin. */
export async function endImpersonationAction(): Promise<void> {
  const e = env();
  const jar = await cookies();
  const u = await currentUser();
  const back = jar.get(ADMIN_RETURN_COOKIE)?.value;
  const token = jar.get(e.SESSION_COOKIE_NAME)?.value;
  if (u?.impersonatedBy && token) {
    await db().delete(sessions).where(eq(sessions.id, sha256(token)));
    const admin = await db().query.users.findFirst({ where: eq(users.id, u.impersonatedBy), columns: { id: true, email: true } });
    await writeAdminAudit(db(), { id: admin?.id ?? null, email: admin?.email ?? "unknown" }, "user.impersonate_end", { type: "user", id: u.id, label: u.email }, null, null, await requestMeta());
  }
  jar.delete(ADMIN_RETURN_COOKIE);
  if (back && u?.impersonatedBy) {
    const row = await db().query.sessions.findFirst({ where: eq(sessions.id, sha256(back)), columns: { userId: true, expiresAt: true } });
    if (row && row.userId === u.impersonatedBy && row.expiresAt > new Date()) {
      jar.set(e.SESSION_COOKIE_NAME, back, { httpOnly: true, secure: e.NODE_ENV === "production", sameSite: "lax", path: "/", expires: row.expiresAt });
      const { redirect } = await import("next/navigation");
      redirect("/admin/users");
    }
  }
  jar.delete(e.SESSION_COOKIE_NAME);
  const { redirect } = await import("next/navigation");
  redirect("/login");
}

// ---------------------------------------------------------------- stores
export async function adminUpdateStoreAction(input: { id: string } & svc.StoreEdit): Promise<ActionState> {
  return run("write", "store.update", async () => {
    const { id, ...rest } = input;
    const { before, after, slugs } = await svc.updateStoreAdmin(db(), str(id), rest);
    invalidateStore(str(id), slugs);
    return { target: { type: "store", id: str(id), label: after.slug }, before, after };
  });
}

export async function adminSetPlanAction(input: { id: string; plan: string; periodEnd?: string | null; months?: number; reason?: string }): Promise<ActionState> {
  return run("write", "store.plan", async () => {
    if (!isPlan(input.plan)) throw new AppError("VALIDATION");
    const cur = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, str(input.id)), columns: { planPeriodEnd: true } });
    let end: Date | null = null;
    if (input.months && input.months > 0 && input.months <= 120) {
      // Extend from the current end when still running, else from now.
      const from = cur?.planPeriodEnd && cur.planPeriodEnd > new Date() ? cur.planPeriodEnd : new Date();
      end = new Date(from);
      end.setUTCMonth(end.getUTCMonth() + Math.floor(input.months));
    } else if (input.periodEnd) end = new Date(`${input.periodEnd}T23:59:59Z`);
    const reason = ["grant", "extend", "comp", "downgrade", "fix"].includes(str(input.reason)) ? str(input.reason) : "manual";
    const { before, after, slug } = await svc.setStorePlan(db(), str(input.id), input.plan, end, reason);
    invalidateStore(str(input.id), [slug]);
    return { target: { type: "store", id: str(input.id), label: slug }, before, after: { ...after, reason } };
  });
}

export async function adminSuspendStoreAction(input: { id: string; suspended: boolean; reason?: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", input.suspended ? "store.suspend" : "store.unsuspend", async (admin) => {
    const st = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, str(input.id)), columns: { slug: true } });
    if (!st) throw new AppError("NOT_FOUND");
    if (input.suspended) await stepUp(admin, st.slug, input);
    const { before, after, slug } = await svc.setStoreSuspended(db(), str(input.id), !!input.suspended, input.reason ?? null);
    invalidateStore(str(input.id), [slug]);
    return { target: { type: "store", id: str(input.id), label: slug }, before, after };
  });
}

export async function adminTransferStoreAction(input: { id: string; email: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", "store.transfer", async (admin) => {
    const st = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, str(input.id)), columns: { slug: true } });
    if (!st) throw new AppError("NOT_FOUND");
    await stepUp(admin, st.slug, input);
    const { before, after, slug } = await svc.transferStore(db(), str(input.id), str(input.email));
    invalidateStore(str(input.id), [slug]);
    return { target: { type: "store", id: str(input.id), label: slug }, before, after };
  });
}

export async function adminResetThemeAction(input: { id: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", "store.reset_theme", async (admin) => {
    const st = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, str(input.id)), columns: { slug: true } });
    if (!st) throw new AppError("NOT_FOUND");
    await stepUp(admin, st.slug, input);
    const { before, after, slug } = await svc.resetStoreTheme(db(), str(input.id));
    invalidateStore(str(input.id), [slug]);
    return { target: { type: "store", id: str(input.id), label: slug }, before, after };
  });
}

export async function adminDeleteStoreAction(input: { id: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", "store.delete", async (admin) => {
    const st = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, str(input.id)), columns: { slug: true } });
    if (!st) throw new AppError("NOT_FOUND");
    await stepUp(admin, st.slug, input);
    const { before, slug } = await svc.deleteStoreAdmin(db(), str(input.id));
    invalidateStore(str(input.id), [slug]);
    return { target: { type: "store", id: str(input.id), label: slug }, before, after: null };
  });
}

export async function adminSetOverrideAction(input: { storeId: string; note?: string } & Partial<Record<LimitKey, string | number | null>>): Promise<ActionState> {
  return run("write", "store.limits", async (admin) => {
    const values: Partial<Record<LimitKey, number | null>> = {};
    for (const k of LIMIT_KEYS) {
      const v = parseLimit(input[k]);
      if (v === "invalid") throw new AppError("VALIDATION", "invalid_limit");
      values[k] = v;
    }
    const { before, after, store } = await svc.setOverride(db(), str(input.storeId), values, input.note ?? null, admin.id);
    invalidateStore(store.id, [store.slug]);
    return { target: { type: "store", id: store.id, label: store.slug }, before: before ? { ...before } : null, after };
  });
}

export async function adminUpgradeDecisionAction(input: { id: string; decision: "activate" | "reject" }): Promise<ActionState> {
  return run("write", input.decision === "activate" ? "upgrade.activate" : "upgrade.reject", async () => {
    const req = await db().query.upgradeRequests.findFirst({ where: (r, { eq: e }) => e(r.id, str(input.id)) });
    if (!req || req.status !== "pending") throw new AppError("NOT_FOUND");
    if (input.decision === "activate") await activateRequest(db(), req.id);
    else await rejectRequest(db(), req.id);
    const st = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, req.storeId), columns: { id: true, slug: true } });
    if (st) invalidateStore(st.id, [st.slug]);
    return { target: { type: "upgrade", id: req.id, label: st?.slug ?? null }, before: { status: req.status, plan: req.plan, months: req.months }, after: { status: input.decision === "activate" ? "activated" : "rejected" } };
  });
}

// ---------------------------------------------------------------- moderation
export async function adminHideProductAction(input: { id: string; hidden: boolean }): Promise<ActionState> {
  return run("write", input.hidden ? "product.hide" : "product.unhide", async () => {
    const { before, after } = await svc.setProductHidden(db(), str(input.id), !!input.hidden);
    invalidateCatalog(before.storeId, [before.id]);
    const st = await db().query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, before.storeId), columns: { slug: true } });
    invalidateStore(before.storeId, [st?.slug]);
    return { target: { type: "product", id: before.id, label: (before.name as Record<string, string>).en ?? Object.values(before.name as Record<string, string>)[0] ?? null }, before, after };
  });
}

export async function adminDeleteProductAction(input: { id: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", "product.delete", async (admin) => {
    const p = await db().query.products.findFirst({ where: (x, { eq: e }) => e(x.id, str(input.id)), columns: { id: true, shortCode: true, storeId: true } });
    if (!p) throw new AppError("NOT_FOUND");
    await stepUp(admin, p.shortCode, input);
    const { before } = await svc.deleteProductAdmin(db(), p.id);
    invalidateCatalog(p.storeId, [p.id]);
    return { target: { type: "product", id: p.id, label: p.shortCode }, before, after: null };
  });
}

export async function adminOrderStatusAction(input: { id: string; status: string }): Promise<ActionState> {
  return run("write", "order.status", async (admin) => {
    if (!isOrderStatus(input.status)) throw new AppError("VALIDATION");
    const o = await db().query.orders.findFirst({ where: (x, { eq: e }) => e(x.id, str(input.id)), columns: { id: true, storeId: true, status: true, publicId: true } });
    if (!o) throw new AppError("NOT_FOUND");
    const after = await updateOrderStatus(db(), o.storeId, o.id, input.status, admin.id, "admin");
    return { target: { type: "order", id: o.id, label: o.publicId }, before: { status: o.status }, after: { status: after.status } };
  });
}

// ---------------------------------------------------------------- site controls
export async function adminSetFlagAction(input: { flag: string; on: boolean }): Promise<ActionState> {
  return run("write", "site.flag", async (admin) => {
    if (!(FEATURE_FLAGS as readonly string[]).includes(input.flag)) throw new AppError("VALIDATION");
    const before = resolveFlags(await getSetting(db(), SETTING_KEYS.flags));
    const after = { ...before, [input.flag as FeatureFlag]: !!input.on };
    await setSetting(db(), SETTING_KEYS.flags, after, admin.id);
    return { target: { type: "setting", id: "flags", label: input.flag }, before: { [input.flag]: before[input.flag as FeatureFlag] }, after: { [input.flag]: !!input.on } };
  });
}

export async function adminSetMaintenanceAction(input: { on: boolean; message?: string; confirm?: string; password?: string }): Promise<ActionState> {
  return run("destructive", input.on ? "site.maintenance_on" : "site.maintenance_off", async (admin) => {
    if (input.on) await stepUp(admin, "maintenance", input);
    const before = parseMaintenance(await getSetting(db(), SETTING_KEYS.maintenance));
    const after = parseMaintenance({ on: !!input.on, message: input.message ?? before.message });
    await setSetting(db(), SETTING_KEYS.maintenance, after, admin.id);
    return { target: { type: "setting", id: "maintenance" }, before, after };
  });
}

export async function adminSetAnnouncementAction(input: { on: boolean; tone: string; href?: string; text: Record<string, string> }): Promise<ActionState> {
  return run("write", "site.announcement", async (admin) => {
    if (!(ANNOUNCE_TONES as readonly string[]).includes(input.tone)) throw new AppError("VALIDATION");
    const before = parseAnnouncement(await getSetting(db(), SETTING_KEYS.announcement));
    const after = parseAnnouncement({ on: !!input.on, tone: input.tone, href: input.href || undefined, text: input.text ?? {} });
    if (input.on && !after.on) throw new AppError("VALIDATION", "announcement_text_required");
    await setSetting(db(), SETTING_KEYS.announcement, after, admin.id);
    return { target: { type: "setting", id: "announcement" }, before, after };
  });
}

const SUBJECT_KEYS = ["reset", "verify"] as const;
export async function adminSetEmailSubjectsAction(input: Record<string, string>): Promise<ActionState> {
  return run("write", "site.email_subjects", async (admin) => {
    const before = ((await getSetting(db(), SETTING_KEYS.emailSubjects)) ?? {}) as Record<string, string>;
    const after: Record<string, string> = {};
    for (const k of SUBJECT_KEYS) {
      const v = typeof input[k] === "string" ? input[k]!.replace(/[\r\n]+/g, " ").trim().slice(0, 140) : "";
      if (v) after[k] = v;
    }
    await setSetting(db(), SETTING_KEYS.emailSubjects, after, admin.id);
    return { target: { type: "setting", id: "email.subjects" }, before, after };
  });
}

export async function adminPaletteSearchAction(q: string): Promise<{ kind: "user" | "store"; id: string; label: string; sub: string | null }[]> {
  try {
    await requireAdminAction("read");
    return await svc.paletteSearch(db(), String(q ?? "").slice(0, 80));
  } catch {
    return [];
  }
}
