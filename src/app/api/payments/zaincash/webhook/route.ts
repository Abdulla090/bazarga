import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { providers } from "@/server/payments/registry";
import { applyPaymentStatus, claimWebhookEvent, syncPaymentFromProvider } from "@/server/payments/service";
import { mapZainCashStatus, zainCashClaims } from "@/server/payments/zaincash";
import { isAppError } from "@/server/errors";

/**
 * ZainCash webhook (production only; URL registered with the ZainCash business team):
 * POST { webhook_token: JWT(HS256, API key) }. Deduplicated by eventId.
 */
export async function POST(req: Request) {
  const zc = providers().zaincash;
  if (!zc.isConfigured()) return NextResponse.json({ ok: false }, { status: 404 });
  const body = z.object({ webhook_token: z.string().min(10).max(10_000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });

  let claims: ReturnType<typeof zainCashClaims>;
  try {
    claims = zainCashClaims(await zc.verifyCallbackToken(body.data.webhook_token));
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!claims.transactionId) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    if (claims.eventId && !(await claimWebhookEvent(db(), "zaincash", claims.eventId))) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (claims.status) await applyPaymentStatus(db(), "zaincash", claims.transactionId, mapZainCashStatus(claims.status), { webhook: claims });
    else await syncPaymentFromProvider(db(), zc, claims.transactionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") return NextResponse.json({ ok: true });
    logger.error("zaincash.webhook_failed", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
