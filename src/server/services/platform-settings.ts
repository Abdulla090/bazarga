import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { platformSettings } from "../db/schema";
import { logger } from "../logger";
import { parseAnnouncement, parseMaintenance, resolveFlags, type Announcement, type FeatureFlag, type Maintenance } from "@/lib/admin";

/**
 * Runtime platform settings (feature flags, maintenance, announcement), cached per instance for TTL_MS.
 * A write clears this instance's cache at once; other instances follow within TTL_MS.
 */
const TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: unknown }>();

export const SETTING_KEYS = { flags: "flags", maintenance: "maintenance", announcement: "announcement", emailSubjects: "email.subjects", cronDaily: "cron.daily" } as const;

export async function getSetting(database: Db, key: string): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const row = await database.query.platformSettings.findFirst({ where: eq(platformSettings.key, key) });
    const value = row?.value ?? null;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    // Fail open to defaults (flags on, no maintenance): a settings read must never take the site down.
    logger.error("platform_settings.read_failed", { err, key });
    return hit?.value ?? null;
  }
}

export async function setSetting(database: Db, key: string, value: unknown, by: string | null): Promise<void> {
  await database
    .insert(platformSettings)
    .values({ key, value, updatedBy: by, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: by, updatedAt: new Date() } });
  cache.delete(key);
}

export function clearSettingsCache() {
  cache.clear();
}

export async function getFlags(database: Db): Promise<Record<FeatureFlag, boolean>> {
  return resolveFlags(await getSetting(database, SETTING_KEYS.flags));
}
export async function flagOn(database: Db, f: FeatureFlag): Promise<boolean> {
  return (await getFlags(database))[f];
}
export async function getMaintenance(database: Db): Promise<Maintenance> {
  return parseMaintenance(await getSetting(database, SETTING_KEYS.maintenance));
}
export async function getAnnouncement(database: Db): Promise<Announcement> {
  return parseAnnouncement(await getSetting(database, SETTING_KEYS.announcement));
}

/** Best-effort heartbeat for the admin health panel. */
export async function recordCronRun(database: Db, name: string, ok: boolean, summary: Record<string, unknown> = {}) {
  try {
    await setSetting(database, `cron.${name}`, { at: new Date().toISOString(), ok, summary }, null);
  } catch (err) {
    logger.error("cron.heartbeat_failed", { err, name });
  }
}
