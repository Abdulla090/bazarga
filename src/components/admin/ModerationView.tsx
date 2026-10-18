"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminDeleteProductAction, adminHideProductAction, adminOrderStatusAction } from "@/server/actions/admin";
import { Badge, Btn, FilterBar, Pager, fmtDate, fmtN, selectCls, useAdminAction, useConfirm } from "./kit";

type P = { id: string; name: string; price: number; stock: number | null; isActive: boolean; hidden: boolean; shortCode: string; storeId: string; storeName: string; storeSlug: string; createdAt: string };
type O = { id: string; publicId: string; number: number; status: string; total: number; paymentMethod: string; paymentStatus: string; customerName: string; customerPhone: string; cityName: string | null; createdAt: string; storeId: string; storeName: string; storeSlug: string };
type Paged<T> = { rows: T[]; total: number; page: number; size: number } | null;

export function ModerationView({ tab, q, state, status, statuses, transitions, products, orders }: { tab: "products" | "orders"; q: string; state: string; status: string; statuses: string[]; transitions: Record<string, readonly string[]>; products: Paged<P>; orders: Paged<O> }) {
  const t = useTranslations("admin");
  const tabCls = (on: boolean) => `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ${on ? "bg-ink text-white" : "border border-line bg-white text-ink-70"}`;
  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist">
        <Link role="tab" aria-selected={tab === "products"} href="?tab=products" className={tabCls(tab === "products")} data-testid="tab-products">{t("cat.products")}</Link>
        <Link role="tab" aria-selected={tab === "orders"} href="?tab=orders" className={tabCls(tab === "orders")} data-testid="tab-orders">{t("cat.orders")}</Link>
      </div>
      {tab === "products" && products && <Products data={products} q={q} state={state} />}
      {tab === "orders" && orders && <Orders data={orders} q={q} status={status} statuses={statuses} transitions={transitions} />}
    </div>
  );
}

function Products({ data, q, state }: { data: NonNullable<Paged<P>>; q: string; state: string }) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  const confirm = useConfirm();
  const [opt, setOpt] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const rows = data.rows.map((p) => ({ ...p, hidden: opt[p.id] ?? p.hidden }));
  const hide = async (p: P, hidden: boolean) => {
    setOpt((o) => ({ ...o, [p.id]: hidden }));
    const r = await run(() => adminHideProductAction({ id: p.id, hidden }));
    if (!r.ok) setOpt((o) => ({ ...o, [p.id]: p.hidden }));
  };
  const bulk = async (hidden: boolean) => {
    for (const id of sel) { setOpt((o) => ({ ...o, [id]: hidden })); await run(() => adminHideProductAction({ id, hidden })); }
    setSel(new Set());
  };
  const qs = (p: number) => `?${new URLSearchParams({ tab: "products", ...(q ? { q } : {}), ...(state !== "all" ? { state } : {}), page: String(p) })}`;
  return (
    <>
      <FilterBar q={q} placeholder={t("cat.searchProducts")} exportHref="/api/admin/export/products">
        <input type="hidden" name="tab" value="products" />
        <select name="state" defaultValue={state} className={selectCls} aria-label={t("c.status")}>
          <option value="all">{t("c.status")}: {t("c.all")}</option>
          <option value="visible">{t("cat.visible")}</option>
          <option value="hidden">{t("cat.hidden")}</option>
        </select>
      </FilterBar>
      {sel.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2 text-sm text-white" data-testid="bulk-bar">
          <span className="me-auto">{t("c.selected", { n: sel.size })}</span>
          <Btn className="!min-h-9" disabled={pending} onClick={() => bulk(true)}>{t("cat.hide")}</Btn>
          <Btn className="!min-h-9" disabled={pending} onClick={() => bulk(false)}>{t("cat.unhide")}</Btn>
        </div>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="products-list">
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-50">{t("c.none")}</li>}
        {rows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm" data-testid="product-row">
            <input type="checkbox" className="size-5 md:size-4" aria-label={p.name} checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-xs text-ink-50"><Link href={`/admin/stores/${p.storeId}`} className="hover:text-[#2563EB]">{p.storeName}</Link> · <span dir="ltr">{p.shortCode}</span> · {fmtDate(p.createdAt)}</p>
            </div>
            <span className="tabular-nums" dir="ltr">{fmtN(p.price)} IQD</span>
            <span className="flex gap-1">{p.hidden ? <Badge tone="red">{t("cat.hidden")}</Badge> : <Badge tone="green">{t("cat.visible")}</Badge>}{!p.isActive && <Badge>{t("cat.inactive")}</Badge>}</span>
            <span className="flex gap-2">
              <Btn onClick={() => hide(p, !p.hidden)} disabled={pending} data-testid="product-hide">{p.hidden ? t("cat.unhide") : t("cat.hide")}</Btn>
              <Btn tone="danger" disabled={pending} aria-label={`${t("c.delete")} ${p.name}`} onClick={() => confirm({ title: t("c.delete"), body: p.name, expected: p.shortCode, confirmLabel: t("c.delete"), onConfirm: (x) => run(() => adminDeleteProductAction({ id: p.id, ...x })) })}>{t("c.delete")}</Btn>
            </span>
          </li>
        ))}
      </ul>
      <Pager page={data.page} total={data.total} size={data.size} hrefFor={qs} />
    </>
  );
}

function Orders({ data, q, status, statuses, transitions }: { data: NonNullable<Paged<O>>; q: string; status: string; statuses: string[]; transitions: Record<string, readonly string[]> }) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  const [opt, setOpt] = useState<Record<string, string>>({});
  const qs = (p: number) => `?${new URLSearchParams({ tab: "orders", ...(q ? { q } : {}), ...(status !== "all" ? { status } : {}), page: String(p) })}`;
  const setStatus = async (o: O, to: string) => {
    setOpt((x) => ({ ...x, [o.id]: to }));
    const r = await run(() => adminOrderStatusAction({ id: o.id, status: to }));
    if (!r.ok) setOpt((x) => ({ ...x, [o.id]: o.status }));
  };
  return (
    <>
      <FilterBar q={q} placeholder={t("cat.searchOrders")} exportHref={`/api/admin/export/orders${status !== "all" ? `?status=${status}` : ""}`}>
        <input type="hidden" name="tab" value="orders" />
        <select name="status" defaultValue={status} className={selectCls} aria-label={t("c.status")}>
          <option value="all">{t("c.status")}: {t("c.all")}</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="orders-list">
        {data.rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-50">{t("c.none")}</li>}
        {data.rows.map((o) => {
          const cur = opt[o.id] ?? o.status;
          const next = transitions[o.status] ?? [];
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm" data-testid="order-row">
              <div className="min-w-0 flex-1">
                <p className="font-medium" dir="ltr">#{o.number} · {o.publicId}</p>
                <p className="truncate text-xs text-ink-50">{o.storeName} · {o.customerName} · <span dir="ltr">{o.customerPhone}</span> · {fmtDate(o.createdAt, true)}</p>
              </div>
              <span className="tabular-nums" dir="ltr">{fmtN(o.total)} IQD</span>
              <span className="text-xs text-ink-50">{o.paymentMethod} · {o.paymentStatus}</span>
              <select className={selectCls} value={cur} disabled={pending || next.length === 0} aria-label={t("c.status")} onChange={(e) => setStatus(o, e.target.value)} data-testid="order-status">
                <option value={o.status}>{o.status}</option>
                {next.map((s) => <option key={s} value={s}>→ {s}</option>)}
              </select>
            </li>
          );
        })}
      </ul>
      <Pager page={data.page} total={data.total} size={data.size} hrefFor={qs} />
    </>
  );
}
