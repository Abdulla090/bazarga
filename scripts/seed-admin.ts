import { and, inArray, ne } from "drizzle-orm";
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
