/**
 * Parse a browser CSP violation report (pure — unit tested, used by /api/csp-report). Accepts the legacy
 * `application/csp-report` body ({"csp-report": {...}}) and the Reporting API batch (`application/reports+json`,
 * [{type:"csp-violation", body:{...}}]). Keeps only what helps fix a policy: directive, the blocked origin (never the
 * full URL: it can carry tokens), the page path, and source position. At most 10 per request.
 */
export type CspViolation = { directive: string; blocked: string; page: string; source?: string; line?: number };

function originOnly(u: unknown): string {
  if (typeof u !== "string" || !u) return "";
  if (/^(inline|eval|data|blob|self|wasm-eval|trusted-types-sink)$/.test(u)) return u;
  try {
    const x = new URL(u);
    return x.protocol === "data:" || x.protocol === "blob:" ? x.protocol.slice(0, -1) : x.origin;
  } catch {
    return u.slice(0, 40);
  }
}
function pathOnly(u: unknown): string {
  if (typeof u !== "string") return "";
  try {
    return new URL(u).pathname.slice(0, 200);
  } catch {
    return "";
  }
}
function one(b: Record<string, unknown>): CspViolation | null {
  const directive = String(b["effective-directive"] ?? b.effectiveDirective ?? b["violated-directive"] ?? b.violatedDirective ?? "").split(" ")[0]!.slice(0, 60);
  if (!directive) return null;
  const src = b["source-file"] ?? b.sourceFile;
  const line = Number(b["line-number"] ?? b.lineNumber);
  return {
    directive,
    blocked: originOnly(b["blocked-uri"] ?? b.blockedURL ?? b.blockedUri),
    page: pathOnly(b["document-uri"] ?? b.documentURL ?? b.documentUri),
    ...(src ? { source: originOnly(src) } : {}),
    ...(Number.isFinite(line) && line > 0 ? { line } : {}),
  };
}

export function parseCspReport(body: unknown): CspViolation[] {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body)) {
    return body
      .filter((r): r is { type: string; body: Record<string, unknown> } => !!r && typeof r === "object" && (r as { type?: unknown }).type === "csp-violation" && typeof (r as { body?: unknown }).body === "object")
      .slice(0, 10)
      .map((r) => one(r.body))
      .filter((v): v is CspViolation => !!v);
  }
  const legacy = (body as Record<string, unknown>)["csp-report"];
  const v = legacy && typeof legacy === "object" ? one(legacy as Record<string, unknown>) : null;
  return v ? [v] : [];
}
