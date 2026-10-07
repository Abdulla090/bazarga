import { toAsciiDigits } from "./phone";
import type { OrderStatus } from "./order-status";

/**
 * Shopper order tracking (pure helpers, shared by the tracking service, the page and tests).
 *
 * The happy path a shopper sees is received → confirmed → on its way → delivered. Exceptions (postponed,
 * refused, returned, cancelled) are shown where they happened, after the last step the order reached.
 */
export const TRACKING_MAIN_PATH = ["pending", "confirmed", "shipped", "delivered"] as const satisfies readonly OrderStatus[];
type MainStatus = (typeof TRACKING_MAIN_PATH)[number];

export type TimelineState = "done" | "current" | "upcoming";
export type TimelineTone = "normal" | "warn" | "bad";
export type TimelineStep = { status: OrderStatus; state: TimelineState; tone: TimelineTone; at: Date | null };
export type TimelineEvent = { toStatus: OrderStatus; createdAt: Date };

const mainIndex = (s: OrderStatus) => (TRACKING_MAIN_PATH as readonly OrderStatus[]).indexOf(s);

/**
 * Order number as a shopper types it: "1001", "#1001", "١٠٠١", " 1 001 ". Returns null for anything that
 * isn't a plausible positive order number (keeps junk out of the DB query and the rate-limit keys).
 */
export function parseOrderNumber(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = toAsciiDigits(String(raw)).replace(/[\s#\u066C,.]/g, "");
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** When the order last entered `status` (null if the history has no such row). */
function lastAt(events: readonly TimelineEvent[], status: OrderStatus): Date | null {
  let at: Date | null = null;
  for (const e of events) if (e.toStatus === status && (!at || e.createdAt >= at)) at = e.createdAt;
  return at;
}

/**
 * Timeline for the tracking page from the current status and the status history (order_events).
 * - On the main path: every step up to the current one is done (the current one is "current" until delivered).
 * - Postponed: steps reached so far are done, "postponed" is current (warn), the rest stay upcoming.
 * - Refused / returned / cancelled: steps reached so far are done, then the exception(s) — no upcoming steps.
 */
export function buildTrackingTimeline(status: OrderStatus, events: readonly TimelineEvent[]): TimelineStep[] {
  const step = (s: OrderStatus, state: TimelineState, tone: TimelineTone = "normal"): TimelineStep => ({
    status: s,
    state,
    tone,
    at: state === "upcoming" ? null : lastAt(events, s),
  });
  const cur = mainIndex(status);
  if (cur >= 0) {
    return TRACKING_MAIN_PATH.map((s: MainStatus, i) =>
      step(s, i < cur || (i === cur && s === "delivered") ? "done" : i === cur ? "current" : "upcoming"),
    );
  }
  // Highest main-path step the order reached before the exception (always at least "received").
  const reached = Math.max(0, ...events.map((e) => mainIndex(e.toStatus)));
  const done = TRACKING_MAIN_PATH.slice(0, reached + 1).map((s) => step(s, "done"));
  switch (status) {
    case "postponed":
      return [...done, step("postponed", "current", "warn"), ...TRACKING_MAIN_PATH.slice(reached + 1).map((s) => step(s, "upcoming"))];
    case "cancelled":
      return [...done, step("cancelled", "current", "bad")];
    case "refused":
      return [...done, step("refused", "current", "bad")];
    case "returned": {
      const refused = events.some((e) => e.toStatus === "refused") ? [step("refused", "done", "bad")] : [];
      return [...done, ...refused, step("returned", "current", "bad")];
    }
    default:
      return done;
  }
}

/** httpOnly cookie holding the public id of the order the shopper last looked up (legacy mm_* prefix). */
export const TRACK_COOKIE = "mm_track";
export const TRACK_COOKIE_TTL_SECONDS = 30 * 60;

/** Path of a store's tracking page; `n` pre-fills the order number. */
export function trackingPath(slug: string, orderNumber?: number): string {
  return `/s/${slug}/track${orderNumber ? `?n=${orderNumber}` : ""}`;
}
