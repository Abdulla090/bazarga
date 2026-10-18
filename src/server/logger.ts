type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT = /pass(word)?|secret|token|authorization|cookie|api[_-]?key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? "[redacted]" : redact(v, depth + 1);
  return out;
}

function minLevel(): Level {
  const l = process.env.LOG_LEVEL as Level | undefined;
  return l && l in ORDER ? l : process.env.NODE_ENV === "test" ? "warn" : "info";
}

/** Structured JSON-lines logger (stdout), with secret redaction. Ship stdout to Loki/Datadog/etc. */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const event = { ts: new Date().toISOString(), level, msg, ...(redact(fields) as object) };
  const line = JSON.stringify(event);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
  if (level === "error") errorHook(event);
}

/**
 * Error hook (env-gated, free): with LOG_WEBHOOK_URL set, every `error` line is also POSTed there, already redacted.
 * Discord and Slack incoming webhooks get a one-line message; any other URL (Better Stack, a Logtail/Axiom HTTP source,
 * your own endpoint) gets the JSON event. Fire-and-forget with a 3 s timeout, at most 20 per minute per instance, and
 * a failing webhook never logs (no loops). Unset → nothing leaves the server.
 */
const HOOK_MAX_PER_MIN = 20;
let hookWindow = 0;
let hookCount = 0;
export function webhookPayload(url: string, event: { level: string; msg: string } & Record<string, unknown>): unknown {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  const err = (event.err as { message?: string } | undefined)?.message;
  const where = [event.route, event.path].find((v) => typeof v === "string");
  const summary = `Bazarga ${event.level}: ${event.msg}${err ? ` — ${err}` : ""}${where ? ` (${String(where)})` : ""}${event.digest ? ` [${String(event.digest)}]` : ""}`.slice(0, 1800);
  if (/(^|\.)discord(app)?\.com$/.test(host)) return { content: summary };
  if (host === "hooks.slack.com") return { text: summary };
  return event;
}
export function shouldSendHook(now = Date.now()): boolean {
  const w = Math.floor(now / 60_000);
  if (w !== hookWindow) {
    hookWindow = w;
    hookCount = 0;
  }
  return ++hookCount <= HOOK_MAX_PER_MIN;
}
function errorHook(event: { level: string; msg: string } & Record<string, unknown>) {
  const url = typeof process !== "undefined" ? process.env.LOG_WEBHOOK_URL : undefined;
  if (!url || typeof window !== "undefined" || !/^https:\/\//.test(url) || !shouldSendHook()) return;
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload(url, event)),
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined);
  } catch {
    // never let reporting break the request
  }
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => log("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => log("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => log("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => log("error", m, f),
};
