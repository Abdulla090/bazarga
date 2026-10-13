import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { jsonError } from "@/server/http";
import { logger } from "@/server/logger";
import { gateway } from "@/server/payments/gateway/registry";
import { publicPaymentView, syncGatewayPayment } from "@/server/payments/gateway/service";

/** Return-page poll: GET ?p=<payment id>. Asks the provider while pending (rate limited); no PII in the answer. */
export async function GET(req: Request) {
  await connection();
  const p = gateway();
  if (!p) return new NextResponse(null, { status: 404 });
  const id = z.uuid().safeParse(new URL(req.url).searchParams.get("p"));
  if (!id.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  try {
    await enforceRateLimit(db(), `paystatus:${id.data}`, 60, 600);
    let view = await publicPaymentView(db(), id.data);
    if (!view) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (view.status === "pending") {
      try {
        await syncGatewayPayment(db(), id.data, "return_page", p);
        view = (await publicPaymentView(db(), id.data)) ?? view;
      } catch (err) {
        logger.warn("gateway.return_sync_failed", { paymentId: id.data, err });
      }
    }
    return NextResponse.json({ status: view.status, next: view.next }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonError(err);
  }
}
