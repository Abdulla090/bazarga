import { getTranslations } from "next-intl/server";
import type { OrderStatus } from "@/lib/order-status";

const OUT = "border border-line text-ink-70 bg-transparent";
const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "border border-ink text-ink bg-transparent",
  confirmed: "border border-[#2563EB] text-[#2563EB] bg-transparent",
  shipped: "border border-[#2563EB] bg-[#2563EB] text-white",
  delivered: "border border-ink bg-ink text-white",
  postponed: OUT,
  refused: OUT + " line-through",
  returned: OUT,
  cancelled: OUT + " line-through",
};
const PAY_STYLE: Record<string, string> = {
  unpaid: OUT,
  pending: "border border-ink text-ink bg-transparent",
  paid: "border border-ink bg-ink text-white",
  failed: OUT + " line-through",
  refunded: OUT,
};

export async function StatusBadge({ status }: { status: OrderStatus }) {
  const t = await getTranslations("orders");
  return <span className={`chip ${STATUS_STYLE[status]}`}>{t(`status_${status}`)}</span>;
}

export async function PaymentBadge({ status }: { status: string }) {
  const t = await getTranslations("orders");
  return <span className={`chip ${PAY_STYLE[status] ?? ""}`}>{t(`pay_${status}` as "pay_paid")}</span>;
}
