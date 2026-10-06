import "server-only";
import { NextResponse } from "next/server";
import { env } from "./env";
import { isAppError } from "./errors";
import { logger } from "./logger";

/**
 * CSRF guard for cookie-authenticated route handlers (server actions already get Next's built-in
 * Origin check). Rejects cross-site requests: Origin must match the request host or APP_URL.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) throw Object.assign(new Error("missing origin"), { status: 403 });
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const o = new URL(origin);
  const allowed = new Set([host, new URL(env().APP_URL).host]);
  if (!allowed.has(o.host)) throw Object.assign(new Error("cross-origin"), { status: 403 });
}

export function jsonError(err: unknown) {
  if (isAppError(err)) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  const status = (err as { status?: number })?.status;
  if (status === 403) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  logger.error("route.unexpected_error", { err });
  return NextResponse.json({ error: "generic" }, { status: 500 });
}
