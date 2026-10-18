import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { validateSession } from "@/server/auth/service";
import { currentStoreFor } from "@/server/auth/session";
import { uploadProcessedImage } from "@/server/storage";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { AppError } from "@/server/errors";
import { assertSameOrigin, jsonError } from "@/server/http";

// sharp needs the Node runtime, which is the default (`runtime` segment config is not allowed with cacheComponents).
/**
 * Seller image upload: POST multipart `file` → { url, image }.
 * `image` is the pipeline result (WebP renditions, dimensions, placeholder) that the product form round-trips.
 * Auth: session cookie; CSRF: Origin check; 120 uploads/hour/store.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const e = env();
    const token = (await cookies()).get(e.SESSION_COOKIE_NAME)?.value ?? "";
    const user = await validateSession(db(), token, e.SESSION_TTL_DAYS);
    if (!user) throw new AppError("UNAUTHENTICATED");
    const store = (await currentStoreFor(user.id))?.store;
    if (!store) throw new AppError("FORBIDDEN");
    await enforceRateLimit(db(), `upload:${store.id}`, 120, 3600);
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > (e.MAX_UPLOAD_MB + 1) * 1024 * 1024) throw new AppError("VALIDATION", "file_too_large");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "empty_file");
    const image = await uploadProcessedImage(store.id, file);
    return NextResponse.json({ url: image.url, image });
  } catch (err) {
    return jsonError(err);
  }
}
