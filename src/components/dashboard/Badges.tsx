import { getTranslations } from "next-intl/server";
import type { OrderStatus } from "@/lib/order-status";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-gold/25 text-ink",
  confirmed: "bg-ink/10 text-ink",
  shipped: "bg-blue-100 text-blue-900",
  delivered: "bg-green/15 text-green",
  postponed: "bg-orange-100 text-orange-900",
  refused: "bg-danger/10 text-danger",
  returned: "bg-ink/10 text-ink-70",
  cancelled: "bg-danger/10 text-danger",
};
const PAY_STYLE: Record<string, string> = {
  unpaid: "bg-ink/5 text-ink-70",
  pending: "bg-gold/20 text-ink",
  paid: "bg-green/15 text-green",
  failed: "bg-danger/10 text-danger",
  refunded: "bg-ink/10 text-ink",
};

export async function StatusBadge({ status }: { status: OrderStatus }) {
  const t = await getTranslations("orders");
  return <span className={`chip ${STATUS_STYLE[status]}`}>{t(`status_${status}`)}</span>;
}

export async function PaymentBadge({ status }: { status: string }) {
  const t = await getTranslations("orders");
  return <span className={`chip ${PAY_STYLE[status] ?? ""}`}>{t(`pay_${status}` as "pay_paid")}</span>;
}
