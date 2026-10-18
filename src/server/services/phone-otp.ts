import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import { phoneOtps, stores, users } from "../db/schema";
import { AppError } from "../errors";
import { sha256 } from "../auth/tokens";
import type { OtpProvider } from "../otp/provider";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

const hashCode = (id: string, phone: string, code: string) => sha256(`${id}:${phone}:${code}`);

/**
 * The account a WhatsApp number signs in to: the user whose own phone it is, else the owner of the store(s) using it
 * as their phone/WhatsApp. Two different accounts on one number → null (ambiguous, never guess).
 */
export async function userIdForPhone(db: Db, phone: string): Promise<string | null> {
  const own = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(2);
  if (own.length === 1) return own[0]!.id;
  if (own.length > 1) return null;
  const owners = await db.selectDistinct({ id: stores.ownerId }).from(stores).where(or(eq(stores.whatsapp, phone), eq(stores.phone, phone))).limit(2);
  return owners.length === 1 ? owners[0]!.id : null;
}

/**
 * Send a login code when the number belongs to an account. Always resolves the same way for unknown numbers
 * (no account enumeration). Returns the code only to callers that ask for it (dev mock / tests).
 */
export async function requestLoginCode(db: Db, phone: string, provider: OtpProvider, now = new Date()): Promise<{ sent: boolean; code?: string }> {
  const userId = await userIdForPhone(db, phone);
  if (!userId) return { sent: false };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Older unused codes for this number stop working.
  await db.update(phoneOtps).set({ consumedAt: now }).where(and(eq(phoneOtps.phone, phone), isNull(phoneOtps.consumedAt)));
  const [row] = await db.insert(phoneOtps).values({ phone, codeHash: "pending", expiresAt: new Date(now.getTime() + OTP_TTL_MS), createdAt: now }).returning({ id: phoneOtps.id });
  await db.update(phoneOtps).set({ codeHash: hashCode(row!.id, phone, code) }).where(eq(phoneOtps.id, row!.id));
  try {
    await provider.send(phone, code);
  } catch {
    await db.update(phoneOtps).set({ consumedAt: now }).where(eq(phoneOtps.id, row!.id));
    throw new AppError("UNAVAILABLE", "otp_send_failed");
  }
  return { sent: true, code };
}

/** Check a code: right number, not expired, not used, under 5 tries. Success consumes it and returns the user id. */
export async function verifyLoginCode(db: Db, phone: string, code: string, now = new Date()): Promise<string> {
  const clean = code.replace(/\D/g, "");
  const [otp] = await db
    .select()
    .from(phoneOtps)
    .where(and(eq(phoneOtps.phone, phone), isNull(phoneOtps.consumedAt), gt(phoneOtps.expiresAt, now)))
    .orderBy(desc(phoneOtps.createdAt))
    .limit(1);
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS || clean.length !== 6) {
    if (otp && clean.length === 6) await db.update(phoneOtps).set({ consumedAt: now }).where(eq(phoneOtps.id, otp.id));
    throw new AppError("VALIDATION", "otp_invalid");
  }
  const want = Buffer.from(otp.codeHash, "hex");
  const got = Buffer.from(hashCode(otp.id, phone, clean), "hex");
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    const [r] = await db.update(phoneOtps).set({ attempts: sql`${phoneOtps.attempts} + 1` }).where(eq(phoneOtps.id, otp.id)).returning({ attempts: phoneOtps.attempts });
    if ((r?.attempts ?? OTP_MAX_ATTEMPTS) >= OTP_MAX_ATTEMPTS) await db.update(phoneOtps).set({ consumedAt: now }).where(eq(phoneOtps.id, otp.id));
    throw new AppError("VALIDATION", "otp_invalid");
  }
  // Consume atomically: a code works once even with two parallel submits.
  const used = await db.update(phoneOtps).set({ consumedAt: now }).where(and(eq(phoneOtps.id, otp.id), isNull(phoneOtps.consumedAt))).returning({ id: phoneOtps.id });
  if (!used.length) throw new AppError("VALIDATION", "otp_invalid");
  const userId = await userIdForPhone(db, phone);
  if (!userId) throw new AppError("VALIDATION", "otp_invalid");
  return userId;
}
