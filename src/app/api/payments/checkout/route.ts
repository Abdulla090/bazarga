import { NextResponse, connection } from "next/server";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { assertSameOrigin, jsonError } from "@/server/http";
import { clientIp } from "@/server/auth/session";
import { sessionStore } from "@/server/share/session";
import { gateway } from "@/server/payments/gateway/registry";
import { checkoutCore } from "@/server/payments/gateway/http";

/**
 * Start a hosted (Rasedi) checkout. { kind: "subscription", plan, months } for the signed-in seller, or
 * { kind: "order", slug, publicId } for a shopper. → { paymentId, url }. 404 while PAYMENTS_PROVIDER is none.
 */
export async function POST(req: Request) {
  await connection();
  const provider = gateway();
  if (!provider) return new NextResponse(null, { status: 404 });
  try {
    assertSameOrigin(req);
    const raw = await req.json().catch(() => null);
    const r = await checkoutCore(db(), provider, raw, { ip: await clientIp(), appUrl: env().APP_URL, sessionStore });
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if ((err as { name?: string })?.name === "ZodError") return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    return jsonError(err);
  }
}
