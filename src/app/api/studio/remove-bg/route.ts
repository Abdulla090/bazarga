import { cookies } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { validateSession } from "@/server/auth/service";
import { currentStoreFor } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { AppError } from "@/server/errors";
import { flagOn } from "@/server/services/platform-settings";
import { assertSameOrigin, jsonError } from "@/server/http";
import { consumeStudioEdit, refundStudioEdit } from "@/server/services/studio-quota";
import { removeBackground } from "@/server/studio/remove-bg";

/**
 * Product Studio AI background removal (SF9). POST multipart `file` → PNG. Spends one monthly Product Studio edit
 * (server-side quota, product_studio_usage) and gives it back if the provider fails. 404 without REMOVE_BG_API_KEY.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const e = env();
    if (!e.REMOVE_BG_API_KEY) throw new AppError("NOT_FOUND");
    const token = (await cookies()).get(e.SESSION_COOKIE_NAME)?.value ?? "";
    const user = await validateSession(db(), token, e.SESSION_TTL_DAYS);
    if (!user) throw new AppError("UNAUTHENTICATED");
    const store = (await currentStoreFor(user.id))?.store;
    if (!store) throw new AppError("FORBIDDEN");
    await enforceRateLimit(db(), `studio:ai:${store.id}`, 20, 3600);
    if (!(await flagOn(db(), "productStudio"))) throw new AppError("UNAVAILABLE");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("VALIDATION", "empty_file");
    if (file.size > (e.MAX_UPLOAD_MB + 1) * 1024 * 1024) throw new AppError("VALIDATION", "file_too_large");
    await consumeStudioEdit(db(), store.id);
    const out = await removeBackground(file, e.REMOVE_BG_API_KEY);
    if (!out) {
      await refundStudioEdit(db(), store.id);
      throw new AppError("UNAVAILABLE", "studio_failed");
    }
    return new Response(out, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonError(err);
  }
}
