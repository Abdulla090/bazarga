/**
 * Server-side error reporting: every uncaught error in a route, server component, server action or route handler is
 * written as one structured JSON line (src/server/logger.ts, secrets redacted) with its digest, so the reference a
 * user sees on an error page can be found in the logs. No third-party service; ship stdout wherever you like.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("./server/logger");
  const e = err as Error & { digest?: string };
  // Not-found / redirect control flow is not an error.
  if (typeof e?.digest === "string" && /^(NEXT_NOT_FOUND|NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK)/.test(e.digest)) return;
  logger.error("request.error", {
    digest: e?.digest,
    err: e,
    method: request.method,
    // Path only: query strings can carry tokens (password reset) or phone numbers.
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
    source: context.renderSource,
  });
}
