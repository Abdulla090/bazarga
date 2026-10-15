/**
 * Browser side of social attribution (docs/SOCIAL-FIRST.md S4). A shopper who lands on a store from a shared link
 * (`/s/<slug>/p/<id>?src=tiktok`) keeps that source for the visit (sessionStorage) and for 7 days (a first-party,
 * per-store cookie, SameSite=Lax), so an order placed later still says "TikTok". Last touch wins. Values are checked
 * against the allowlist here and re-validated with zod at checkout (orderSourceSchema).
 */
import { parseSource, sourceCookieName, sourceStorageKey, SOURCE_COOKIE_MAX_AGE, type OrderSource } from "./social";

type Env = { session?: Pick<Storage, "getItem" | "setItem"> | null; doc?: { cookie: string } | null };

function env(): Env {
  if (typeof window === "undefined") return {};
  let session: Storage | null = null;
  try {
    session = window.sessionStorage;
  } catch {
    /* storage blocked (private mode / embedded webview) */
  }
  return { session, doc: document };
}

/** Saves `?src=` from `search` when it is on the allowlist; returns the saved source (null when absent/invalid). */
export function captureSource(slug: string, search: string, e: Env = env()): OrderSource | null {
  const src = parseSource(new URLSearchParams(search).get("src"));
  if (!src) return null;
  try {
    e.session?.setItem(sourceStorageKey(slug), src);
  } catch {}
  if (e.doc) e.doc.cookie = `${sourceCookieName(slug)}=${src}; path=/; max-age=${SOURCE_COOKIE_MAX_AGE}; samesite=lax`;
  return src;
}

/** The source to attach to an order: this visit's, else the 7-day cookie's, else null (direct). */
export function readSource(slug: string, e: Env = env()): OrderSource | null {
  let v: string | null = null;
  try {
    v = e.session?.getItem(sourceStorageKey(slug)) ?? null;
  } catch {}
  if (!v && e.doc) {
    const name = `${sourceCookieName(slug)}=`;
    v = e.doc.cookie.split(/;\s*/).find((c) => c.startsWith(name))?.slice(name.length) ?? null;
  }
  return parseSource(v);
}
