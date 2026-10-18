/**
 * Every CRON_SECRET-protected route, in one list (docs/LAUNCH.md "Cron" mirrors it; tests/integrations.test.ts
 * checks both). Each answers 404 while CRON_SECRET is unset, 401 without `Authorization: Bearer <CRON_SECRET>`,
 * and is safe to call repeatedly or concurrently.
 */
export type CronRoute = { path: string; methods: readonly ("GET" | "POST")[]; schedule: string; every: string; purpose: string };

export const CRON_ROUTES: readonly CronRoute[] = [
  {
    path: "/api/cron/daily",
    methods: ["GET"],
    schedule: "0 3 * * *",
    every: "daily 03:00 UTC (06:00 Baghdad)",
    purpose: "plan expiry, payment reconcile + abandoned-order expiry, prune rate-limit counters",
  },
  {
    path: "/api/cron/payments",
    methods: ["GET", "POST"],
    schedule: "*/5 * * * *",
    every: "every 5 minutes (only matters once an online payment provider is on)",
    purpose: "payment reconcile + release stock of unpaid online orders after PAYMENT_ORDER_TTL_MINUTES",
  },
];

/** Full URLs for an external pinger (cron-job.org, UptimeRobot, GitHub Actions…). */
export function cronPingerUrls(appUrl: string): string[] {
  const base = appUrl.replace(/\/+$/, "");
  return CRON_ROUTES.map((r) => `${base}${r.path}`);
}
