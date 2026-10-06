import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { validateSession } from "@/server/auth/service";
import { getStoreForOwner } from "@/server/services/stores";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { createProductsFromPhotos, visionProvider } from "@/server/ai";
import { storage } from "@/server/storage";
import { validateImage } from "@/server/storage/image";
import { AppError } from "@/server/errors";
import { assertSameOrigin, jsonError } from "@/server/http";
import { randomUUID } from "node:crypto";

export const maxDuration = 60;

/**
 * POST multipart: photos (≤ 6 images) + message (any language)
 * → { drafts: DraftProduct[], photoUrls: string[] }. Drafts are NOT saved; the seller confirms them.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const e = env();
    if (!visionProvider()) throw new AppError("UNAVAILABLE", "ai_disabled");
    const token = (await cookies()).get(e.SESSION_COOKIE_NAME)?.value ?? "";
    const user = await validateSession(db(), token, e.SESSION_TTL_DAYS);
    if (!user) throw new AppError("UNAUTHENTICATED");
    const store = await getStoreForOwner(db(), user.id);
    if (!store) throw new AppError("FORBIDDEN");
    await enforceRateLimit(db(), `ai:${store.id}`, 30, 3600);

    const form = await req.formData();
    const message = String(form.get("message") ?? "").slice(0, 4000);
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 6);
    const photos: { mime: string; base64: string }[] = [];
    const photoUrls: string[] = [];
    for (const f of files) {
      const buf = new Uint8Array(await f.arrayBuffer());
      const type = validateImage(buf, e.MAX_UPLOAD_MB);
      const stored = await storage().put(`stores/${store.id}/${randomUUID()}.${type.ext}`, buf, type.mime);
      photoUrls.push(stored.url);
      photos.push({ mime: type.mime, base64: Buffer.from(buf).toString("base64") });
    }
    const drafts = await createProductsFromPhotos({ photos, message, storeLocale: store.defaultLocale });
    return NextResponse.json({ drafts, photoUrls });
  } catch (err) {
    return jsonError(err);
  }
}
