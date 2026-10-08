import "server-only";
import { cookies } from "next/headers";
import { db } from "../db";
import { env } from "../env";
import { validateSession } from "../auth/service";
import { getStoreForOwner, type Store } from "../services/stores";
import { AppError } from "../errors";

/** The signed-in seller's store for a route handler (same rule as /api/uploads: the store comes from the session only). */
export async function sessionStore(): Promise<Store> {
  const e = env();
  const token = (await cookies()).get(e.SESSION_COOKIE_NAME)?.value ?? "";
  const user = await validateSession(db(), token, e.SESSION_TTL_DAYS);
  if (!user) throw new AppError("UNAUTHENTICATED");
  const store = await getStoreForOwner(db(), user.id);
  if (!store) throw new AppError("FORBIDDEN");
  return store;
}
