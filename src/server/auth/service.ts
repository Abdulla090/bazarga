import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { Db } from "../db";
import { passwordResetTokens, sessions, users } from "../db/schema";
import { AppError } from "../errors";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import { newToken, sha256 } from "./tokens";
import { emailProvider } from "../email";
import { logger } from "../logger";
import type { Locale } from "@/lib/i18n";

export type SessionUser = { id: string; email: string; name: string; locale: Locale };

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
  return { id: u.id, email: u.email, name: u.name, locale: u.locale };
}

export async function createSession(
  database: Db,
  userId: string,
  ttlDays: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await database.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip?.slice(0, 64) ?? null,
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

/** Always resolves (never reveals whether the email exists). */
export async function requestPasswordReset(database: Db, email: string, appUrl: string): Promise<void> {
  const u = await database.query.users.findFirst({ where: eq(users.email, email) });
  if (!u) return;
  const token = newToken();
  await database.insert(passwordResetTokens).values({
    tokenHash: sha256(token),
    userId: u.id,
    expiresAt: new Date(Date.now() + 60 * 60_000),
  });
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await emailProvider().send({
      to: u.email,
      subject: "my market — reset your password / وشەی نهێنی نوێ",
      text: `Reset your my market password (valid 1 hour):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    });
  } catch (err) {
    logger.error("auth.reset_email_failed", { err });
  }
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
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, t.userId));
    // Sign out everywhere after a reset.
    await tx.delete(sessions).where(eq(sessions.userId, t.userId));
  });
}
