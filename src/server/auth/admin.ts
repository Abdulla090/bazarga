import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { db } from "../db";
import { users } from "../db/schema";
import { AppError } from "../errors";
import { currentUser, requireUser } from "./session";
import { enforceRateLimit } from "./rate-limit";
import { can, effectiveRole, isAdminRole, parseAdminEmails, type AdminPerm, type PlatformRole } from "@/lib/admin";

export function isAdminEmail(email: string, list: string = env().ADMIN_EMAILS): boolean {
  return parseAdminEmails(list).has(email.trim().toLowerCase());
}

export type AdminUser = { id: string; email: string; name: string; role: PlatformRole };

/** Signed-in user's platform role (ADMIN_EMAILS ∪ users.role), memoised per request. Impersonation sessions never count. */
export const currentAdmin = cache(async (): Promise<AdminUser | null> => {
  const u = await currentUser();
  if (!u || u.impersonatedBy) return null;
  const row = await db().query.users.findFirst({ where: eq(users.id, u.id), columns: { id: true, email: true, name: true, role: true, status: true } });
  if (!row) return null;
  const role = effectiveRole(row, env().ADMIN_EMAILS);
  return isAdminRole(role) ? { id: row.id, email: row.email, name: row.name, role } : null;
});

/** Page guard: anyone who is not a platform admin gets a 404, so /admin stays invisible. */
export async function requireAdmin(perm: AdminPerm = "read"): Promise<AdminUser> {
  await requireUser();
  const a = await currentAdmin();
  if (!a || !can(a.role, perm)) notFound();
  return a;
}

/**
 * Action guard: FORBIDDEN unless a platform admin with `perm`, then per-admin rate limits
 * (120 writes / minute; destructive and team actions 20 / 10 minutes).
 */
export async function requireAdminAction(perm: AdminPerm = "write"): Promise<AdminUser> {
  const a = await currentAdmin();
  if (!a || !can(a.role, perm)) throw new AppError("FORBIDDEN", "admin_only");
  await enforceRateLimit(db(), `admin:${a.id}`, 120, 60);
  if (perm === "destructive" || perm === "team") await enforceRateLimit(db(), `admin-danger:${a.id}`, 20, 600);
  return a;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim().slice(0, 64) || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}
