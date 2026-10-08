import { connection } from "next/server";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { jsonError } from "@/server/http";
import { sessionStore } from "@/server/share/session";
import { loadStoreImage } from "@/server/share/assets";
import { renderStoryPng } from "@/server/share/story";
import { loadMessages } from "@/i18n/messages";
import { displayUrl, shareFileName, storeUrl, storyLocale } from "@/lib/share-kit";
import { pickText } from "@/lib/i18n";
import { resolveTheme } from "@/lib/theme";

type Msgs = { shareKit: Record<string, string>; store: Record<string, string> };

/**
 * Instagram/WhatsApp story image (1080×1920 PNG) for the signed-in seller's store.
 * GET ?lang=ku|ar|en|kmr (default: the store's language) [&download=1]. Rendered server-side with sharp; ~0.3 s.
 */
export async function GET(req: Request) {
  // Per request, never prerendered: the response depends on the session cookie.
  await connection();
  try {
    const store = await sessionStore();
    await enforceRateLimit(db(), `share-story:${store.id}`, 60, 3600);
    const q = new URL(req.url).searchParams;
    const locale = storyLocale(q.get("lang"), store.defaultLocale);
    const m = (await loadMessages(locale)) as unknown as Msgs;
    const url = storeUrl(env().APP_URL, store.slug);
    const png = await renderStoryPng({
      name: store.name,
      tagline: pickText(store.tagline, locale),
      url,
      printedUrl: displayUrl(url),
      logo: await loadStoreImage(store.logoUrl, store.id),
      theme: resolveTheme(store.themePreset, store.accentColor),
      text: { cta: m.shareKit.storyCta!, scan: m.shareKit.storyScan!, poweredBy: m.store.poweredBy! },
    });
    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (q.get("download") === "1") headers["Content-Disposition"] = `attachment; filename="${shareFileName(store.slug, "story", "png", locale)}"`;
    return new Response(new Uint8Array(png), { headers });
  } catch (err) {
    return jsonError(err);
  }
}
