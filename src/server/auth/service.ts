import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { emailVerificationTokens, passwordResetTokens, sessions, users } from "../db/schema";
import { AppError } from "../errors";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import { newToken, sha256 } from "./tokens";
import { emailProvider } from "../email";
import { logger } from "../logger";
import { resetMail, verifyMail } from "./mail-copy";
import type { Locale } from "@/lib/i18n";

export type SessionUser = { id: string; email: string; name: string; locale: Locale; /** Set on an admin "view as" session (migration 0030). */ impersonatedBy?: string | null };

export async function signUp(
  database: Db,
  input: { name: string; email: string; password: string; locale: Locale },
): Promise<SessionUser> {
  const existing = await database.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw new AppError("CONFLICT", "email_taken");
  const passwordHash = await hashPassword(input.password);
  const [u] = await database
    .insert(users)
    .values({ name: input.name, email: input.email, passwordHash, locale: input.locale })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (!u) throw new AppError("CONFLICT", "email_taken");
  return { id: u.id, email: u.email, name: u.name, locale: u.locale };
}

export async function authenticate(database: Db, email: string, password: string): Promise<SessionUser> {
  const u = await database.query.users.findFirst({ where: eq(users.email, email) });
  if (!u) {
    await verifyPassword(password, await dummyHash()); // constant-ish timing
    throw new AppError("UNAUTHENTICATED", "invalid_credentials");
  }
  if (!(await verifyPassword(password, u.passwordHash))) throw new AppError("UNAUTHENTICATED", "invalid_credentials");
  // Suspended / banned by the platform admin (docs/ADMIN.md): same answer as a wrong password, no enumeration.
  if (u.status && u.status !== "active") throw new AppError("UNAUTHENTICATED", "invalid_credentials");
  return { id: u.id, email: u.email, name: u.name, locale: u.locale };
}

export async function createSession(
  database: Db,
  userId: string,
  ttlDays: number,
  meta: { userAgent?: string | null; ip?: string | null; impersonatedBy?: string | null; ttlMinutes?: number } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + (meta.ttlMinutes ? meta.ttlMinutes * 60_000 : ttlDays * 86_400_000));
  await database.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip?.slice(0, 64) ?? null,
    impersonatedBy: meta.impersonatedBy ?? null,
  });
  return { token, expiresAt };
}

/** Resolve a raw session token to its user; extends sessions that are past half their life (sliding expiry). */
export async function validateSession(database: Db, token: string, ttlDays: number): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const rows = await database
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Suspended / banned users are signed out everywhere at once.
  if (row.u.status && row.u.status !== "active") return null;
  // Admin "view as" sessions are short-lived and never slide.
  if (row.s.impersonatedBy) return { id: row.u.id, email: row.u.email, name: row.u.name, locale: row.u.locale, impersonatedBy: row.s.impersonatedBy };
  const halfLife = (ttlDays * 86_400_000) / 2;
  if (row.s.expiresAt.getTime() - Date.now() < halfLife) {
    await database
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + ttlDays * 86_400_000) })
      .where(eq(sessions.id, id));
  }
  return { id: row.u.id, email: row.u.email, name: row.u.name, locale: row.u.locale };
}

export async function deleteSession(database: Db, token: string) {
  await database.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function deleteExpiredSessions(database: Db) {
  await database.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** Always resolves (never reveals whether the email exists). A new request retires any link still outstanding. */
export async function requestPasswordReset(database: Db, email: string, appUrl: string): Promise<void> {
  const u = await database.query.users.findFirst({ where: eq(users.email, email) });
  if (!u) return;
  const token = newToken();
  await database.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, u.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      tokenHash: sha256(token),
      userId: u.id,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
  });
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await emailProvider().send({ to: u.email, ...(await withSubject(database, "reset", resetMail(u.locale, link))) });
  } catch (err) {
    logger.error("auth.reset_email_failed", { err });
  }
}

const VERIFY_TTL_MS = 24 * 3600_000;

export async function isEmailVerified(database: Db, userId: string): Promise<boolean> {
  const u = await database.query.users.findFirst({ where: eq(users.id, userId), columns: { emailVerifiedAt: true } });
  return !!u?.emailVerifiedAt;
}

/**
 * Emails a one-time confirmation link to the account's current address. No-op when already verified.
 * Never throws on a provider failure (sign-up must not break because mail is down); returns whether a mail went out.
 */
export async function sendVerificationEmail(database: Db, userId: string, appUrl: string): Promise<boolean> {
  const u = await database.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u || u.emailVerifiedAt) return false;
  const token = newToken();
  await database.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(emailVerificationTokens.userId, u.id), isNull(emailVerificationTokens.usedAt)));
    await tx.insert(emailVerificationTokens).values({
      tokenHash: sha256(token),
      userId: u.id,
      email: u.email,
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    });
  });
  const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await emailProvider().send({ to: u.email, ...(await withSubject(database, "verify", verifyMail(u.locale, link))) });
    return true;
  } catch (err) {
    logger.error("auth.verify_email_failed", { err });
    return false;
  }
}

/** Single-use: marks the address verified only if it is still the one the link was issued for. */
export async function verifyEmail(database: Db, token: string): Promise<void> {
  const tokenHash = sha256(token);
  await database.transaction(async (tx) => {
    const [t] = await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!t) throw new AppError("VALIDATION", "invalid_or_expired_token");
    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, t.userId), eq(users.email, t.email)));
  });
}

export async function resetPassword(database: Db, token: string, newPassword: string): Promise<void> {
  const tokenHash = sha256(token);
  const passwordHash = await hashPassword(newPassword);
  await database.transaction(async (tx) => {
    const [t] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!t) throw new AppError("VALIDATION", "invalid_or_expired_token");
    // Receiving the reset link proves the address is theirs.
    await tx
      .update(users)
      .set({ passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
      .where(eq(users.id, t.userId));
    // Sign out everywhere after a reset.
    await tx.delete(sessions).where(eq(sessions.userId, t.userId));
  });
}

/** Admin subject-line override (Site controls → Email subjects, platform_settings "email.subjects"); body is untouched. */
async function withSubject(database: Db, key: "reset" | "verify", mail: { subject: string; text: string }) {
  try {
    const { getSetting, SETTING_KEYS } = await import("../services/platform-settings");
    const v = ((await getSetting(database, SETTING_KEYS.emailSubjects)) ?? {}) as Record<string, unknown>;
    return typeof v[key] === "string" && v[key] ? { ...mail, subject: v[key] as string } : mail;
  } catch {
    return mail;
  }
}
