import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { pushSubscriptions } from "@/server/db/schema";
import {
  MAX_FAILURES,
  deleteSellerSubscription,
  pushConfig,
  saveSellerSubscription,
  sendToStoreSellers,
  type PushSender,
} from "@/server/push";
import { pushNewOrder } from "@/server/services/notify-order";
import { placeOrder } from "@/server/services/orders";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
let A: Awaited<ReturnType<typeof seller>>;
let B: Awaited<ReturnType<typeof seller>>;

const sub = (id: string) => ({
  endpoint: `https://push.example.com/send/${id}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
});
const payload = { title: "t", body: "b", url: "/dashboard/orders" };
const httpError = (statusCode: number) => Object.assign(new Error(`push ${statusCode}`), { statusCode });
const rows = (storeId: string) => database.select().from(pushSubscriptions).where(eq(pushSubscriptions.storeId, storeId));

beforeAll(async () => {
  database = await testDb();
  A = await seller(database, "pusha");
  B = await seller(database, "pushb");
});

describe("pushConfig", () => {
  it("is off unless all three VAPID values are set", () => {
    expect(pushConfig({})).toBeNull();
    expect(pushConfig({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k" })).toBeNull();
    expect(pushConfig({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k", VAPID_SUBJECT: " " })).toBeNull();
    expect(pushConfig({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k", VAPID_SUBJECT: "mailto:a@b.c" })).toEqual({
      publicKey: "p",
      privateKey: "k",
      subject: "mailto:a@b.c",
    });
  });
});

describe("seller subscriptions", () => {
  it("saves, rejects non-https endpoints, and upserts on endpoint", async () => {
    await saveSellerSubscription(database, { userId: A.user.id, storeId: A.store.id }, sub("a1"), "UA");
    await saveSellerSubscription(database, { userId: A.user.id, storeId: A.store.id }, sub("a1"), "UA2");
    expect(await rows(A.store.id)).toHaveLength(1);
    await expect(
      saveSellerSubscription(database, { userId: A.user.id, storeId: A.store.id }, { ...sub("x"), endpoint: "http://insecure/x" }),
    ).rejects.toThrow();
  });

  it("only the owner can delete a subscription", async () => {
    await deleteSellerSubscription(database, B.user.id, sub("a1").endpoint);
    expect(await rows(A.store.id)).toHaveLength(1);
    await deleteSellerSubscription(database, A.user.id, sub("a1").endpoint);
    expect(await rows(A.store.id)).toHaveLength(0);
  });
});

describe("sendToStoreSellers", () => {
  it("sends only to the store's sellers and drops 404/410 subscriptions", async () => {
    for (const id of ["ok", "gone404", "gone410", "flaky"]) {
      await saveSellerSubscription(database, { userId: A.user.id, storeId: A.store.id }, sub(id));
    }
    await saveSellerSubscription(database, { userId: B.user.id, storeId: B.store.id }, sub("other-store"));
    const sender = vi.fn<PushSender>(async (target) => {
      if (target.endpoint.endsWith("gone404")) throw httpError(404);
      if (target.endpoint.endsWith("gone410")) throw httpError(410);
      if (target.endpoint.endsWith("flaky")) throw httpError(500);
      return {};
    });
    const res = await sendToStoreSellers(database, A.store.id, payload, sender);
    expect(res).toEqual({ sent: 1, pruned: 2, failed: 1 });
    expect(sender).toHaveBeenCalledTimes(4);
    expect(sender.mock.calls.every(([t]) => !t.endpoint.endsWith("other-store"))).toBe(true);
    expect(JSON.parse(sender.mock.calls[0]![1])).toEqual(payload);

    const left = await rows(A.store.id);
    expect(left.map((r) => r.endpoint.split("/").pop()).sort()).toEqual(["flaky", "ok"]);
    expect(left.find((r) => r.endpoint.endsWith("flaky"))!.failureCount).toBe(1);
    expect(left.find((r) => r.endpoint.endsWith("ok"))!.lastSuccessAt).toBeInstanceOf(Date);
  });

  it("drops a subscription after repeated failures", async () => {
    const failing = vi.fn<PushSender>(async (t) => {
      if (t.endpoint.endsWith("flaky")) throw httpError(503);
      return {};
    });
    for (let i = 1; i < MAX_FAILURES; i++) await sendToStoreSellers(database, A.store.id, payload, failing);
    expect((await rows(A.store.id)).map((r) => r.endpoint.split("/").pop())).toEqual(["ok"]);
  });

  it("never throws when the sender blows up unexpectedly", async () => {
    const boom = vi.fn<PushSender>(async () => {
      throw new Error("network down");
    });
    await expect(sendToStoreSellers(database, A.store.id, payload, boom)).resolves.toMatchObject({ sent: 0 });
  });
});

describe("new-order push", () => {
  it("pushes the order number and dashboard link to the store's sellers", async () => {
    const p = await product(database, B.store.id, 10_000, 5);
    const order = await placeOrder(database, B.store, checkout([{ productId: p.id, quantity: 2 }]));
    const sender = vi.fn<PushSender>(async () => ({}));
    await pushNewOrder(database, B.store, order, sender);
    expect(sender).toHaveBeenCalledTimes(1);
    const body = JSON.parse(sender.mock.calls[0]![1]);
    expect(body.title).toContain(`#${order.number}`);
    expect(body.url).toBe(`/dashboard/orders/${order.id}`);
    expect(body.dir).toBe("rtl");
  });

  it("is a no-op without VAPID config", async () => {
    const p = await product(database, B.store.id, 5_000);
    const order = await placeOrder(database, B.store, checkout([{ productId: p.id, quantity: 1 }]));
    delete process.env.VAPID_PUBLIC_KEY;
    await expect(pushNewOrder(database, B.store, order)).resolves.toBeUndefined();
  });
});
