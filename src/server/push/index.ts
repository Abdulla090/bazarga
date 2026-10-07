import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db";
import { pushSubscriptions } from "../db/schema";
import { logger } from "../logger";

/**
 * Web Push for sellers (new-order alerts).
 * - VAPID keys come from env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT); with any of them missing the
 *   whole feature is off: `pushConfig()` returns null, the dashboard hides the toggle, sends are no-ops.
 * - The transport is injectable (`PushSender`) so the send/prune logic is tested without the network.
 * - 404/410 from the push service = subscription is gone → deleted. Other failures bump failure_count; after
 *   MAX_FAILURES consecutive failures the subscription is dropped too.
 */
export const MAX_FAILURES = 5;

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export function pushConfig(e: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = e.VAPID_PUBLIC_KEY?.trim();
  const privateKey = e.VAPID_PRIVATE_KEY?.trim();
  const subject = e.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export const subscriptionSchema = z.object({
  endpoint: z.url().refine((u) => u.startsWith("https://"), "endpoint_https"),
  keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(64) }),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushPayload = { title: string; body: string; url: string; tag?: string; dir?: "rtl" | "ltr"; lang?: string };
/** Resolves on success; rejects with an error carrying `statusCode` on push-service errors. */
export type PushSender = (target: PushTarget, payload: string) => Promise<unknown>;

/** Real transport: the `web-push` library, configured with the VAPID keys. Loaded lazily (server-only, on send). */
export async function webPushSender(cfg: VapidConfig): Promise<PushSender> {
  const webpush = (await import("web-push")).default;
  const details = { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey };
  return (target, payload) => webpush.sendNotification(target, payload, { vapidDetails: details, TTL: 60 * 60 * 12, urgency: "high" });
}

export async function saveSellerSubscription(
  database: Db,
  owner: { userId: string; storeId: string },
  input: SubscriptionInput,
  userAgent?: string | null,
) {
  const sub = subscriptionSchema.parse(input);
  // Endpoint is unique: re-subscribing (or the same browser moving to another account) takes it over.
  await database
    .insert(pushSubscriptions)
    .values({
      audience: "seller",
      userId: owner.userId,
      storeId: owner.storeId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent?.slice(0, 300) ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        audience: "seller",
        userId: owner.userId,
        storeId: owner.storeId,
        orderId: null,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
        failureCount: 0,
      },
    });
}

/** Removes a subscription only if it belongs to this seller. */
export async function deleteSellerSubscription(database: Db, userId: string, endpoint: string) {
  await database.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

export type SendResult = { sent: number; pruned: number; failed: number };

/** Sends `payload` to every seller subscription of the store. Never throws. */
export async function sendToStoreSellers(database: Db, storeId: string, payload: PushPayload, sender: PushSender): Promise<SendResult> {
  const result: SendResult = { sent: 0, pruned: 0, failed: 0 };
  let subs: (typeof pushSubscriptions.$inferSelect)[];
  try {
    subs = await database
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.storeId, storeId), eq(pushSubscriptions.audience, "seller")));
  } catch (err) {
    logger.error("push.load_failed", { err, storeId });
    return result;
  }
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        result.sent++;
        await database
          .update(pushSubscriptions)
          .set({ lastSuccessAt: new Date(), failureCount: 0 })
          .where(eq(pushSubscriptions.id, s.id));
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        try {
          if (status === 404 || status === 410 || s.failureCount + 1 >= MAX_FAILURES) {
            await database.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
            result.pruned++;
          } else {
            await database
              .update(pushSubscriptions)
              .set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
              .where(eq(pushSubscriptions.id, s.id));
            result.failed++;
          }
        } catch (dbErr) {
          logger.error("push.prune_failed", { err: dbErr });
        }
        if (status !== 404 && status !== 410) logger.warn("push.send_failed", { status, storeId });
      }
    }),
  );
  return result;
}
