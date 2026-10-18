import "server-only";
import { connection } from "next/server";
import { db } from "../db";
import { currentAdmin } from "../auth/admin";
import { getAnnouncement, getMaintenance } from "../services/platform-settings";
import { announcementText, type AnnounceTone } from "@/lib/admin";

/** Maintenance message when maintenance mode is on and the viewer is not a platform admin; null = render normally. */
// Both read runtime settings from the DB, so they are request-time: connection() keeps them out of the prerender
// (without a DB, as in CI, the failed read is logged with a timestamp and Next aborts the build on the "current time").
export async function maintenanceFor(): Promise<{ message: string } | null> {
  await connection();
  const m = await getMaintenance(db());
  if (!m.on) return null;
  if (await currentAdmin()) return null; // admins bypass
  return { message: m.message };
}

export async function announcementFor(locale: string): Promise<{ text: string; tone: AnnounceTone; href?: string } | null> {
  await connection();
  const a = await getAnnouncement(db());
  const text = announcementText(a, locale);
  return text ? { text, tone: a.tone, href: a.href } : null;
}
