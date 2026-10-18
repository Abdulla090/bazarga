import { NextResponse, connection } from "next/server";
import { db } from "@/server/db";
import { currentAdmin, requestMeta } from "@/server/auth/admin";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { listAllOrders, listAllProducts, listStores, listUsers, listWaitlist } from "@/server/admin/service";
import { listAdminAudit, writeAdminAudit } from "@/server/admin/audit";
import { toCsv } from "@/lib/admin";
import { isOrderStatus } from "@/lib/order-status";

const KINDS = ["users", "stores", "products", "orders", "waitlist", "audit"] as const;
type Kind = (typeof KINDS)[number];
const name = (n: unknown) => { const o = (n ?? {}) as Record<string, string>; return o.en || o.ku || o.ar || o.kmr || ""; };

/** Admin CSV exports (GET, no side effects besides the audit row). Non-admins get a plain 404. */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  await connection();
  const admin = await currentAdmin();
  const { kind } = await ctx.params;
  if (!admin || !(KINDS as readonly string[]).includes(kind)) return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  try {
    await enforceRateLimit(db(), `admin-export:${admin.id}`, 30, 600);
  } catch {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const url = new URL(req.url);
  const k = kind as Kind;
  let csv = "";
  // Up to 40 pages of 25 for the paged lists (1 000 rows); orders and waitlist up to 5 000.
  const pages = async <T,>(fn: (page: number) => Promise<{ rows: T[]; total: number; size: number }>) => {
    const out: T[] = [];
    for (let p = 1; p <= 40; p++) {
      const r = await fn(p);
      out.push(...r.rows);
      if (p * r.size >= r.total) break;
    }
    return out;
  };
  if (k === "users") {
    const rows = await pages((page) => listUsers(db(), { page }));
    csv = toCsv(["id", "email", "name", "phone", "role", "status", "email_verified", "stores", "created_at"], rows.map((r) => [r.id, r.email, r.name, r.phone, r.role, r.status, r.emailVerifiedAt ? "yes" : "no", r.storeCount, r.createdAt]));
  } else if (k === "stores") {
    const rows = await pages((page) => listStores(db(), { page }));
    csv = toCsv(["id", "name", "slug", "owner_email", "plan", "plan_period_end", "published", "suspended_at", "featured", "products", "orders", "created_at"], rows.map((r) => [r.id, r.name, r.slug, r.ownerEmail, r.plan, r.planPeriodEnd, r.isActive, r.suspendedAt, r.featured, r.productCount, r.orderCount, r.createdAt]));
  } else if (k === "products") {
    const rows = await pages((page) => listAllProducts(db(), { page }));
    csv = toCsv(["id", "store", "name", "price_iqd", "stock", "active", "hidden_by_admin", "code", "created_at"], rows.map((r) => [r.id, r.storeSlug, name(r.name), r.price, r.stock, r.isActive, r.hiddenByAdminAt ? "yes" : "no", r.shortCode, r.createdAt]));
  } else if (k === "orders") {
    const st = url.searchParams.get("status");
    const r = await listAllOrders(db(), { status: isOrderStatus(st) ? st : "all", limit: 5000 });
    csv = toCsv(["id", "public_id", "number", "store", "status", "total_iqd", "payment_method", "payment_status", "customer", "phone", "city", "created_at"], r.rows.map((o) => [o.id, o.publicId, o.number, o.storeSlug, o.status, o.total, o.paymentMethod, o.paymentStatus, o.customerName, o.customerPhone, o.cityName, o.createdAt]));
  } else if (k === "waitlist") {
    const rows = await listWaitlist(db(), "", 5000);
    csv = toCsv(["seq", "name", "whatsapp", "instagram", "sells", "city", "locale", "ref_code", "referrals", "created_at"], rows.map((r) => [r.seq, r.name, r.whatsapp, r.instagram, r.sells, r.city, r.locale, r.refCode, r.referralCount, r.createdAt]));
  } else {
    const r = await listAdminAudit(db(), { pageSize: 200 });
    csv = toCsv(["at", "actor", "action", "target_type", "target_id", "target", "ip", "before", "after"], r.rows.map((a) => [a.createdAt, a.actorEmail, a.action, a.targetType, a.targetId, a.targetLabel, a.ip, JSON.stringify(a.before), JSON.stringify(a.after)]));
  }
  await writeAdminAudit(db(), { id: admin.id, email: admin.email }, "export.csv", { type: "export", id: k }, null, { kind: k }, await requestMeta());
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reelcart-${k}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
