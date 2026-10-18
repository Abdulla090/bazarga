import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { env } from "../env";
import { AppError } from "../errors";
import { createSession, deleteSession, validateSession, type SessionUser } from "./service";
import { CURRENT_STORE_COOKIE, resolveCurrentStore } from "../services/store-access";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function startSession(userId: string) {
  const e = env();
  const h = await headers();
  const { token, expiresAt } = await createSession(db(), userId, e.SESSION_TTL_DAYS, {
    userAgent: h.get("user-agent"),
    ip: await clientIp(),
  });
  (await cookies()).set(e.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: e.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const e = env();
  const jar = await cookies();
  const token = jar.get(e.SESSION_COOKIE_NAME)?.value;
  if (token) await deleteSession(db(), token);
  jar.delete(e.SESSION_COOKIE_NAME);
}

/** Current user (memoised per request). */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const e = env();
  const token = (await cookies()).get(e.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSession(db(), token, e.SESSION_TTL_DAYS);
});

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/**
 * The tenant boundary: resolves the signed-in seller's store. Every dashboard read/write
 * passes `store.id` from here — never a store id from the client.
 */
export const requireStore = cache(async () => {
  const user = await requireUser();
  const preferred = (await cookies()).get(CURRENT_STORE_COOKIE)?.value;
  const current = await resolveCurrentStore(db(), user.id, preferred);
  if (!current) redirect("/onboarding");
  return { user, store: current.store, role: current.role };
});

/** Owner-only dashboard actions (store settings, billing, team, domains, deleting things): staff get FORBIDDEN. */
export async function requireOwner() {
  const ctx = await requireStore();
  if (ctx.role !== "owner") throw new AppError("FORBIDDEN", "owner_only");
  return ctx;
}

/** Current store for route handlers (same resolution as requireStore, without redirects). */
export async function currentStoreFor(userId: string) {
  const preferred = (await cookies()).get(CURRENT_STORE_COOKIE)?.value;
  return resolveCurrentStore(db(), userId, preferred);
}
