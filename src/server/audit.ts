import { headers } from "next/headers";
import { db } from "./db";
import { auditLog } from "./db/schema";
import { logger } from "./logger";

export const AUDIT_ACTIONS = ["store.update", "store.theme", "store.storefront", "store.pixels", "store.showcase", "payment.toggle", "payout.profile"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Short, secret-free description of what changed: field names only, never values. */
export function auditDetail(fields: Iterable<string>): string {
  return [...new Set(fields)].filter((f) => /^[a-zA-Z0-9_.:-]{1,40}$/.test(f)).sort().slice(0, 20).join(",");
}

/** Best-effort: an audit failure must never block the seller's change. */
export async function recordAudit(storeId: string, userId: string | null, action: AuditAction, detail = ""): Promise<void> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 64) || null;
    await db().insert(auditLog).values({ storeId, userId, action, detail: detail.slice(0, 500) || null, ip });
  } catch (err) {
    logger.error("audit.write_failed", { err, action });
  }
}
