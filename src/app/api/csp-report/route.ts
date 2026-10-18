import { NextResponse, connection } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { clientIp } from "@/server/auth/session";
import { parseCspReport } from "@/lib/csp-report";

const MAX_BYTES = 16_384;

/**
 * CSP violation sink (`report-uri` / `report-to` in src/server/csp.ts). Each violation becomes one structured
 * `csp.violation` log line (origin-only URLs, no query strings). Always 204 so a browser never retries; 30 reports per
 * 10 min per IP, the rest are dropped silently.
 */
export async function POST(req: Request) {
  await connection();
  try {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return new NextResponse(null, { status: 204 });
    await enforceRateLimit(db(), `csp-report:${await clientIp()}`, 30, 600);
    for (const v of parseCspReport(JSON.parse(raw))) logger.warn("csp.violation", v);
  } catch {
    // Malformed body or rate limited: nothing to do.
  }
  return new NextResponse(null, { status: 204 });
}
