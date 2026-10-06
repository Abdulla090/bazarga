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
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(redact(fields) as object) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => log("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => log("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => log("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => log("error", m, f),
};
