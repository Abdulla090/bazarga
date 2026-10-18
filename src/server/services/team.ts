import { withOverride } from "./limit-overrides";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db";
import { storeMembers, stores, users, type StoreMember } from "../db/schema";
import { AppError } from "../errors";
import { newToken, sha256 } from "../auth/tokens";
import { TEAM_LIMIT, hasFeature, normalizePlan } from "@/lib/plans";

export const INVITE_TTL_DAYS = 7;
const emailSchema = z.email().max(254).transform((e) => e.trim().toLowerCase());

export type TeamUsage = { used: number; limit: number };

/** Seats in use = active members + open invites (the owner is never counted). */
export async function teamUsage(database: Db, storeId: string): Promise<TeamUsage> {
  const [st] = await database.select({ plan: stores.plan }).from(stores).where(eq(stores.id, storeId));
  if (!st) throw new AppError("NOT_FOUND");
  const [c] = await database.select({ n: sql<number>`count(*)` }).from(storeMembers).where(eq(storeMembers.storeId, storeId));
  return { used: Number(c?.n ?? 0), limit: await withOverride(database, storeId, "seats", TEAM_LIMIT[normalizePlan(st.plan)]) };
}

export async function listMembers(database: Db, storeId: string) {
  return database
    .select({ id: storeMembers.id, email: storeMembers.email, role: storeMembers.role, acceptedAt: storeMembers.acceptedAt, expiresAt: storeMembers.expiresAt, invitedAt: storeMembers.invitedAt, name: users.name })
    .from(storeMembers)
    .leftJoin(users, eq(users.id, storeMembers.userId))
    .where(eq(storeMembers.storeId, storeId))
    .orderBy(asc(storeMembers.invitedAt));
}

/**
 * Invite a staff member by email (Pro 2 / Business 5 / Max 10 seats, enforced here). Re-inviting a pending address
 * issues a fresh token and expiry. Returns the raw token once; only its hash is stored.
 */
export async function inviteMember(database: Db, storeId: string, invitedBy: string, rawEmail: string, now = new Date()) {
  const email = emailSchema.parse(rawEmail);
  const [st] = await database.select({ plan: stores.plan, ownerId: stores.ownerId }).from(stores).where(eq(stores.id, storeId));
  if (!st) throw new AppError("NOT_FOUND");
  if (!hasFeature(normalizePlan(st.plan), "team")) throw new AppError("FORBIDDEN", "plan_feature");
  const owner = await database.query.users.findFirst({ where: eq(users.id, st.ownerId), columns: { email: true } });
  if (owner?.email.toLowerCase() === email) throw new AppError("VALIDATION", "already_member");
  const existing = await database.query.storeMembers.findFirst({ where: and(eq(storeMembers.storeId, storeId), eq(storeMembers.email, email)) });
  if (existing?.acceptedAt) throw new AppError("VALIDATION", "already_member");
  const token = newToken();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 864e5);
  if (existing) {
    await database.update(storeMembers).set({ tokenHash: sha256(token), expiresAt, invitedAt: now, invitedBy }).where(eq(storeMembers.id, existing.id));
    return { id: existing.id, email, token, expiresAt };
  }
  const usage = await teamUsage(database, storeId);
  if (usage.used >= usage.limit) throw new AppError("FORBIDDEN", "plan_limit_team");
  const [row] = await database.insert(storeMembers).values({ storeId, email, role: "staff", tokenHash: sha256(token), invitedBy, invitedAt: now, expiresAt }).returning({ id: storeMembers.id });
  return { id: row!.id, email, token, expiresAt };
}

/** Invite details for the accept page (no secrets). Null when the token is unknown, used or expired. */
export async function findInvite(database: Db, token: string, now = new Date()) {
  if (!token || token.length > 100) return null;
  const [m] = await database
    .select({ id: storeMembers.id, email: storeMembers.email, expiresAt: storeMembers.expiresAt, storeId: stores.id, storeName: stores.name })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .where(and(eq(storeMembers.tokenHash, sha256(token)), isNull(storeMembers.acceptedAt)));
  if (!m || (m.expiresAt && m.expiresAt < now)) return null;
  return m;
}

/** Accept an invite as the signed-in user. The account email must match the invited address. */
export async function acceptInvite(database: Db, token: string, user: { id: string; email: string }, now = new Date()) {
  const inv = await findInvite(database, token, now);
  if (!inv) throw new AppError("VALIDATION", "invalid_or_expired_token");
  if (inv.email !== user.email.toLowerCase()) throw new AppError("FORBIDDEN", "invite_wrong_account");
  const [st] = await database.select({ ownerId: stores.ownerId }).from(stores).where(eq(stores.id, inv.storeId));
  if (st?.ownerId === user.id) throw new AppError("VALIDATION", "already_member");
  await database.update(storeMembers).set({ userId: user.id, acceptedAt: now, tokenHash: null }).where(eq(storeMembers.id, inv.id));
  return { storeId: inv.storeId };
}

/** Remove a member or cancel an invite (tenant-scoped). */
export async function removeMember(database: Db, storeId: string, memberId: string) {
  const r = await database.delete(storeMembers).where(and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, storeId))).returning({ id: storeMembers.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}

/** Stores the user joined as staff (accepted invites only). */
export async function memberStoreIds(database: Db, userId: string): Promise<string[]> {
  const rows = await database.select({ storeId: storeMembers.storeId }).from(storeMembers).where(and(eq(storeMembers.userId, userId), isNotNull(storeMembers.acceptedAt)));
  return rows.map((r) => r.storeId);
}

export type { StoreMember };
