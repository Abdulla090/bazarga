import { and, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { parseAdminEmails } from "../src/lib/admin";

/**
 * SEED_ADMIN_EMAIL (comma-separated): existing accounts with these emails become platform owners (users.role = owner)
 * on every seed run (`npm run db:seed`, also part of the Vercel build). Only promotes, never demotes; unknown emails are
 * skipped (the account must sign up first). Unset → nothing happens. Removing an admin is done in /admin/settings.
 * See docs/ADMIN.md.
 */
export async function promoteSeedAdmins(db: Db, raw: string | undefined = process.env.SEED_ADMIN_EMAIL): Promise<string[]> {
  const emails = [...parseAdminEmails(raw)];
  if (!emails.length) return [];
  const rows = await db.update(users).set({ role: "owner" }).where(and(inArray(users.email, emails), ne(users.role, "owner"))).returning({ email: users.email });
  return rows.map((r) => r.email);
}

/**
 * Security A7: the public demo account (credentials are on the landing page) must never hold a platform role.
 * Demotes `demoEmail` to `user` unless it is explicitly listed in SEED_ADMIN_EMAIL or ADMIN_EMAILS. Idempotent:
 * returns true only when a row changed. Runs on every seed, so production self-heals on each deploy.
 */
export async function demoteDemoAdmin(
  db: Db,
  demoEmail: string = process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app",
  seedAdmins: string | undefined = process.env.SEED_ADMIN_EMAIL,
  adminEmails: string | undefined = process.env.ADMIN_EMAILS,
): Promise<boolean> {
  const email = demoEmail.trim().toLowerCase();
  if (!email) return false;
  if (parseAdminEmails(seedAdmins).has(email) || parseAdminEmails(adminEmails).has(email)) return false;
  const rows = await db.update(users).set({ role: "user" }).where(and(eq(users.email, email), ne(users.role, "user"))).returning({ id: users.id });
  return rows.length > 0;
}
