import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { providers } from "@/server/payments/registry";
import { syncPaymentFromProvider } from "@/server/payments/service";
import { isAppError } from "@/server/errors";

/**
 * FIB status callback: POST { id, status }. The body is unsigned, so we only use `id` and fetch the
 * authoritative status from FIB. Idempotent; always answers 200 for known/unknown ids so FIB stops retrying
 * on permanent errors, 502 on transient upstream failures so it retries.
 */
export async function POST(req: Request) {
  const body = z.object({ id: z.string().min(1).max(100) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  const fib = providers().fib;
  if (!fib.isConfigured()) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const r = await syncPaymentFromProvider(db(), fib, body.data.id);
    return NextResponse.json({ ok: true, changed: r.changed });
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") {
      logger.warn("fib.callback_unknown_payment", { id: body.data.id });
      return NextResponse.json({ ok: true });
    }
    logger.error("fib.callback_failed", { id: body.data.id, err });
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
