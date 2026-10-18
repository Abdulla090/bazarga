import "server-only";
import { db } from "../db";
import { currentAdmin } from "../auth/admin";
import { getAnnouncement, getMaintenance } from "../services/platform-settings";
import { announcementText, type AnnounceTone } from "@/lib/admin";

/** Maintenance message when maintenance mode is on and the viewer is not a platform admin; null = render normally. */
export async function maintenanceFor(): Promise<{ message: string } | null> {
  const m = await getMaintenance(db());
  if (!m.on) return null;
  if (await currentAdmin()) return null; // admins bypass
  return { message: m.message };
}

export async function announcementFor(locale: string): Promise<{ text: string; tone: AnnounceTone; href?: string } | null> {
  const a = await getAnnouncement(db());
  const text = announcementText(a, locale);
  return text ? { text, tone: a.tone, href: a.href } : null;
}
