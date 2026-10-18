import "server-only";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { adminAudit } from "../db/schema";
import { logger } from "../logger";
import { auditSnapshot } from "@/lib/admin";

export type AuditActor = { id: string | null; email: string };
export type AuditTarget = { type: string; id?: string | null; label?: string | null };
export type AuditMeta = { ip?: string | null; userAgent?: string | null };

/**
 * Write one admin-audit row. Snapshots go through auditSnapshot (secrets redacted, size-capped).
 * Returns false (and logs) when the write fails so callers can surface it; never throws.
 */
export async function writeAdminAudit(
  database: Db,
  actor: AuditActor,
  action: string,
  target: AuditTarget,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  meta: AuditMeta = {},
): Promise<boolean> {
  try {
    await database.insert(adminAudit).values({
      actorId: actor.id,
      actorEmail: actor.email.slice(0, 200),
      action: action.slice(0, 80),
      targetType: target.type.slice(0, 40),
      targetId: target.id?.slice(0, 80) ?? null,
      targetLabel: target.label?.slice(0, 200) ?? null,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
    return true;
  } catch (err) {
    logger.error("admin_audit.write_failed", { err, action });
    return false;
  }
}

export type AuditFilter = { q?: string; action?: string; targetType?: string; actor?: string; from?: Date | null; to?: Date | null; page?: number; pageSize?: number };

export async function listAdminAudit(database: Db, f: AuditFilter = {}) {
  const where: SQL[] = [];
  if (f.action) where.push(ilike(adminAudit.action, `${f.action.replace(/[%_]/g, "")}%`));
  if (f.targetType) where.push(eq(adminAudit.targetType, f.targetType));
  if (f.actor) where.push(ilike(adminAudit.actorEmail, `%${f.actor.replace(/[%_]/g, "")}%`));
  if (f.from) where.push(gte(adminAudit.createdAt, f.from));
  if (f.to) where.push(lte(adminAudit.createdAt, f.to));
  if (f.q) {
    const q = `%${f.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(adminAudit.targetLabel, q), ilike(adminAudit.targetId, q), ilike(adminAudit.action, q))!);
  }
  const size = Math.min(Math.max(f.pageSize ?? 50, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [c]] = await Promise.all([
    database.select().from(adminAudit).where(cond).orderBy(desc(adminAudit.createdAt)).limit(size).offset((page - 1) * size),
    database.select({ n: sql<number>`count(*)::int` }).from(adminAudit).where(cond),
  ]);
  return { rows, total: Number(c?.n ?? 0), page, size };
}
