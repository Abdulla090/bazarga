import "server-only";
import { notFound } from "next/navigation";
import { env } from "../env";
import { requireUser } from "./session";

export function isAdminEmail(email: string, list: string = env().ADMIN_EMAILS): boolean {
  const set = list.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return set.includes(email.trim().toLowerCase());
}

/** Admin gate: unknown/unauthorised → 404 so /admin is invisible. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) notFound();
  return user;
}
