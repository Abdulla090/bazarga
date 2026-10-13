import { NextResponse, connection } from "next/server";
import { db } from "@/server/db";
import { gateway } from "@/server/payments/gateway/registry";
import { handleGatewayWebhook } from "@/server/payments/gateway/service";

const MAX_BODY = 16 * 1024;

/**
 * Gateway webhook (Rasedi → POST /api/payments/webhook/rasedi?token=…). Authenticated by the secret token we put in
 * the callbackUrl (401 otherwise), idempotent per (provider, reference, status), and it never trusts the body: the
 * status is re-fetched from the provider and applied in one transaction. 404 while PAYMENTS_PROVIDER is none.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  await connection();
  const { provider } = await params;
  const p = gateway();
  if (!p || p.id !== provider) return new NextResponse(null, { status: 404 });
  const body = await req.text();
  if (body.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  const r = await handleGatewayWebhook(db(), provider, { url: req.url, headers: req.headers, body }, p);
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return new NextResponse(null, { status: 404 });
}
