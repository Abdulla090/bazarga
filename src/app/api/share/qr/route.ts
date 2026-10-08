import { connection } from "next/server";
import sharp from "sharp";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { jsonError } from "@/server/http";
import { sessionStore } from "@/server/share/session";
import { qrSvg, shareFileName, storeUrl } from "@/lib/share-kit";

/**
 * QR code for the signed-in seller's store link. GET ?format=svg|png [&download=1].
 * Read-only and session-scoped (no store id in the URL), so there is nothing to forge cross-site.
 */
export async function GET(req: Request) {
  // Per request, never prerendered: the response depends on the session cookie.
  await connection();
  try {
    const store = await sessionStore();
    await enforceRateLimit(db(), `share-qr:${store.id}`, 300, 3600);
    const q = new URL(req.url).searchParams;
    const format = q.get("format") === "png" ? "png" : "svg";
    const svg = qrSvg(storeUrl(env().APP_URL, store.slug), { px: 1200 });
    const body = format === "png" ? new Uint8Array(await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()) : svg;
    const headers: Record<string, string> = {
      "Content-Type": format === "png" ? "image/png" : "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    };
    if (q.get("download") === "1") headers["Content-Disposition"] = `attachment; filename="${shareFileName(store.slug, "qr", format)}"`;
    return new Response(body, { headers });
  } catch (err) {
    return jsonError(err);
  }
}
