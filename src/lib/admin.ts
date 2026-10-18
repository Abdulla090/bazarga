/**
 * Owner admin console: pure rules shared by the server guard, the services and the tests (docs/ADMIN.md).
 * No I/O here.
 */

export type PlatformRole = "user" | "admin" | "owner";
export type UserStatus = "active" | "suspended" | "banned";
export const PLATFORM_ROLES = ["user", "admin", "owner"] as const satisfies readonly PlatformRole[];
export const USER_STATUSES = ["active", "suspended", "banned"] as const satisfies readonly UserStatus[];

/** Admin capabilities. `owner` = everything; `admin` = everything except managing the admin team. */
export type AdminPerm = "read" | "write" | "destructive" | "team";
const PERMS: Record<PlatformRole, readonly AdminPerm[]> = {
  user: [],
  admin: ["read", "write", "destructive"],
  owner: ["read", "write", "destructive", "team"],
};

export function parseAdminEmails(list: string | undefined | null): Set<string> {
  return new Set((list ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

/** Effective platform role: ADMIN_EMAILS (env) always means owner; otherwise the DB role. Suspended/banned users have none. */
export function effectiveRole(u: { email: string; role?: string | null; status?: string | null }, adminEmails: string | Set<string>): PlatformRole {
  if (u.status && u.status !== "active") return "user";
  const set = typeof adminEmails === "string" ? parseAdminEmails(adminEmails) : adminEmails;
  if (set.has(u.email.trim().toLowerCase())) return "owner";
  return u.role === "owner" || u.role === "admin" ? u.role : "user";
}

export function can(role: PlatformRole, perm: AdminPerm): boolean {
  return PERMS[role].includes(perm);
}

export const isAdminRole = (r: PlatformRole) => r === "admin" || r === "owner";

/**
 * Step-up confirmation for destructive actions: the admin types the target's name (or e-mail / slug).
 * Case- and whitespace-insensitive; an empty expectation never matches.
 */
export function stepUpMatches(expected: string | null | undefined, typed: unknown): boolean {
  const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  if (!expected || typeof typed !== "string") return false;
  const e = norm(expected);
  return e.length > 0 && norm(typed) === e;
}

// ---------------------------------------------------------------- feature flags
export const FEATURE_FLAGS = ["signups", "waitlist", "aiDescriptions", "aiDesigner", "productStudio", "whatsappLogin", "showcase"] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
/** Every flag defaults to on: an empty settings table changes nothing. */
export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = Object.fromEntries(FEATURE_FLAGS.map((f) => [f, true])) as Record<FeatureFlag, boolean>;

export function resolveFlags(stored: unknown): Record<FeatureFlag, boolean> {
  const out = { ...FLAG_DEFAULTS };
  if (stored && typeof stored === "object") {
    for (const f of FEATURE_FLAGS) {
      const v = (stored as Record<string, unknown>)[f];
      if (typeof v === "boolean") out[f] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------- announcement + maintenance
export const ANNOUNCE_TONES = ["blue", "ink", "green", "amber", "red"] as const;
export type AnnounceTone = (typeof ANNOUNCE_TONES)[number];
export type Announcement = { on: boolean; tone: AnnounceTone; text: Partial<Record<"en" | "ku" | "ar" | "kmr", string>>; href?: string };
export const ANNOUNCE_OFF: Announcement = { on: false, tone: "blue", text: {} };

export function parseAnnouncement(v: unknown): Announcement {
  if (!v || typeof v !== "object") return ANNOUNCE_OFF;
  const o = v as Record<string, unknown>;
  const tone = (ANNOUNCE_TONES as readonly string[]).includes(String(o.tone)) ? (o.tone as AnnounceTone) : "blue";
  const text: Announcement["text"] = {};
  const t = (o.text ?? {}) as Record<string, unknown>;
  for (const l of ["en", "ku", "ar", "kmr"] as const) if (typeof t[l] === "string" && t[l]) text[l] = (t[l] as string).slice(0, 280);
  const href = typeof o.href === "string" && /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(o.href) ? o.href.slice(0, 300) : undefined;
  return { on: o.on === true && Object.keys(text).length > 0, tone, text, ...(href ? { href } : {}) };
}

/** Text for the visitor's locale, falling back to English then any filled locale. */
export function announcementText(a: Announcement, locale: string): string | null {
  if (!a.on) return null;
  return a.text[locale as keyof Announcement["text"]] || a.text.en || Object.values(a.text).find(Boolean) || null;
}

export type Maintenance = { on: boolean; message: string };
export function parseMaintenance(v: unknown): Maintenance {
  if (!v || typeof v !== "object") return { on: false, message: "" };
  const o = v as Record<string, unknown>;
  return { on: o.on === true, message: typeof o.message === "string" ? o.message.slice(0, 500) : "" };
}

/** Paths that keep working during maintenance so the owner can still sign in and switch it off. */
export function maintenanceExempt(pathname: string): boolean {
  return /^\/(admin|login|api\/health|api\/cron|e404)(\/|$)/.test(pathname);
}

// ---------------------------------------------------------------- limit overrides
export const LIMIT_KEYS = ["products", "studioEdits", "aiCredits", "seats", "stores"] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export const LIMIT_MAX = 1_000_000;

/** Override wins when set (0 is a real override: "none allowed"); otherwise the plan's own limit. */
export function applyOverride(planLimit: number, override: number | null | undefined): number {
  return typeof override === "number" && Number.isFinite(override) && override >= 0 ? Math.min(override, LIMIT_MAX) : planLimit;
}

/** Parse a form value: "" / null → no override; otherwise a whole number 0..LIMIT_MAX. */
export function parseLimit(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  if (!/^\d{1,7}$/.test(s)) return "invalid";
  const n = Number(s);
  return n <= LIMIT_MAX ? n : "invalid";
}

// ---------------------------------------------------------------- audit snapshots
const SECRET_KEY = /pass(word)?|hash|token|secret|key$|apikey|otp|code_hash|cookie/i;

/** A secret-free, size-capped snapshot for the audit log (values kept, secrets redacted, long strings cut). */
export function auditSnapshot(o: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!o) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o).slice(0, 40)) {
    if (SECRET_KEY.test(k)) { out[k] = "[redacted]"; continue; }
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "string") out[k] = v.length > 300 ? `${v.slice(0, 300)}…` : v;
    else if (v === null || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else {
      const s = JSON.stringify(v) ?? "";
      out[k] = s.length > 600 ? `${s.slice(0, 600)}…` : v;
    }
  }
  return out;
}

/** Keys whose value differs between before and after (for the audit list "changed: a, b"). */
export function changedKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null)).sort();
}

// ---------------------------------------------------------------- CSV
/** RFC 4180 cell + formula-injection guard (=, +, -, @ at the start are prefixed with '). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- impersonation
export const IMPERSONATION_MINUTES = 30;
export const ADMIN_RETURN_COOKIE = "mm_admin_return";

// ---------------------------------------------------------------- KPIs
/** Monthly recurring revenue estimate in USD: paid stores × the plan's monthly list price (yearly counted per month). */
export function mrrEstimate(planCounts: Record<string, number>, monthly: Record<string, number>): number {
  return Object.entries(planCounts).reduce((sum, [plan, n]) => sum + (monthly[plan] ?? 0) * n, 0);
}

/** Group dates into the last `days` calendar days (UTC), oldest first. */
export function dailySeries(dates: Date[], days: number, now = new Date()): { day: string; n: number }[] {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86_400_000;
  const out = Array.from({ length: days }, (_, i) => ({ day: new Date(start + i * 86_400_000).toISOString().slice(0, 10), n: 0 }));
  for (const d of dates) {
    const i = Math.floor((d.getTime() - start) / 86_400_000);
    if (i >= 0 && i < days) out[i]!.n++;
  }
  return out;
}

export const ADMIN_PAGE_SIZE = 25;

// ---------------------------------------------------------------- overview periods
export const ADMIN_PERIODS = ["7d", "30d", "90d", "all"] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];
export const parsePeriod = (v: unknown): AdminPeriod => ((ADMIN_PERIODS as readonly string[]).includes(String(v)) ? (v as AdminPeriod) : "30d");
/** Days a period covers; "all" spans from the first record (at least 7 days, at most two years of daily points). */
export function periodDays(p: AdminPeriod, first: Date | null, now = new Date()): number {
  if (p !== "all") return Number(p.slice(0, -1));
  if (!first) return 7;
  const days = Math.ceil((now.getTime() - first.getTime()) / 86_400_000) + 1;
  return Math.min(730, Math.max(7, days));
}

// ---------------------------------------------------------------- database browser
/**
 * Columns the read-only database browser never shows: password/token/OTP hashes, session ids (sha256 of the cookie),
 * API keys and idempotency keys, push-subscription keys, payout account numbers, raw provider payloads, checkout links.
 */
const SECRET_COLUMN = /(^|_)(password|hash|token|secret|otp|api_?key|idempotency_key|p256dh|auth|endpoint|account_identifier|account_number|iban|checkout_url|payload|raw)($|_)/i;
const SECRET_EXACT = new Set(["sessions.id", "users.password_hash", "seller_payout_profiles.account_identifier", "push_subscriptions.endpoint", "push_subscriptions.auth", "push_subscriptions.p256dh"]);
export const MASK = "••••••";

export function isSecretColumn(table: string, column: string): boolean {
  return SECRET_EXACT.has(`${table}.${column}`) || SECRET_COLUMN.test(column) || /hash$/i.test(column);
}

/** One cell as the browser shows it: secrets masked, dates ISO, JSON stringified, long values cut. */
export function browserCell(table: string, column: string, v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (isSecretColumn(table, column)) return MASK;
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v) ?? "";
  else s = String(v);
  return s.length > 240 ? `${s.slice(0, 240)}…` : s;
}

export const DB_BROWSER_PAGE_SIZE = 50;
