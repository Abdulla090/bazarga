import { and, eq, isNotNull, ne } from "drizzle-orm";
import { resolve4, resolveCname } from "node:dns/promises";
import type { Db } from "../db";
import { stores } from "../db/schema";
import { AppError } from "../errors";
import { logger } from "../logger";
import { checkDns, isReservedDomain, normalizeDomain, type DnsLookup, type DomainTargets } from "@/lib/custom-domain";

export const nodeDns: DnsLookup = { cname: (h) => resolveCname(h), a: (h) => resolve4(h) };

/** Save (or clear with "") the store's domain. Changing it resets verification. Throws VALIDATION invalid_domain / domain_taken. */
export async function setCustomDomain(db: Db, storeId: string, raw: string, platformHosts: string[]): Promise<string | null> {
  if (!raw.trim()) {
    await db.update(stores).set({ customDomain: null, customDomainVerifiedAt: null }).where(eq(stores.id, storeId));
    return null;
  }
  const host = normalizeDomain(raw);
  if (!host || isReservedDomain(host, platformHosts)) throw new AppError("VALIDATION", "invalid_domain");
  const [taken] = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.customDomain, host), ne(stores.id, storeId)));
  if (taken) throw new AppError("VALIDATION", "domain_taken");
  const [cur] = await db.select({ d: stores.customDomain }).from(stores).where(eq(stores.id, storeId));
  if (cur?.d !== host) await db.update(stores).set({ customDomain: host, customDomainVerifiedAt: null }).where(eq(stores.id, storeId));
  return host;
}

/** DNS check; marks the domain verified when it points at the platform (and un-verifies it when it stops). */
export async function verifyCustomDomain(db: Db, storeId: string, targets: DomainTargets, dns: DnsLookup = nodeDns, now = new Date()) {
  const [st] = await db.select({ d: stores.customDomain }).from(stores).where(eq(stores.id, storeId));
  if (!st?.d) throw new AppError("VALIDATION", "invalid_domain");
  const r = await checkDns(st.d, targets, dns);
  await db.update(stores).set({ customDomainVerifiedAt: r.ok ? now : null }).where(eq(stores.id, storeId));
  return { host: st.d, ...r };
}

/** Slug of the active store a verified custom domain belongs to (proxy lookup). */
export async function storeSlugForDomain(db: Db, host: string): Promise<string | null> {
  const h = normalizeDomain(host);
  if (!h) return null;
  const [r] = await db
    .select({ slug: stores.slug })
    .from(stores)
    .where(and(eq(stores.customDomain, h), isNotNull(stores.customDomainVerifiedAt), eq(stores.isActive, true)));
  return r?.slug ?? null;
}

export type VercelCfg = { token?: string; projectId?: string; teamId?: string };
export const vercelApiOn = (c: VercelCfg) => !!(c.token && c.projectId);

/**
 * Attach the domain to the operator's Vercel project (only when VERCEL_TOKEN + VERCEL_PROJECT_ID are set). Already
 * attached counts as success. Returns "added" | "manual" (not configured) | "error".
 */
export async function addDomainToVercel(host: string, c: VercelCfg, fetchImpl: typeof fetch = fetch): Promise<"added" | "manual" | "error"> {
  if (!vercelApiOn(c)) return "manual";
  const q = c.teamId ? `?teamId=${encodeURIComponent(c.teamId)}` : "";
  try {
    const res = await fetchImpl(`https://api.vercel.com/v10/projects/${encodeURIComponent(c.projectId!)}/domains${q}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: host }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "added";
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
    // Already on this project counts as done; "in use" means another Vercel project owns it (the seller must free it).
    if (body.error?.code === "domain_already_exists") return "added";
    logger.warn("domain.vercel_add_failed", { status: res.status, code: body.error?.code });
    return "error";
  } catch {
    return "error";
  }
}
