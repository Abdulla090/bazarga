"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isOwnerOnlyPath } from "@/lib/team";
import { ChartColumnIncreasing, ChevronForward, CreditCard, House, Icon, Menu, Palette, QrCode, Receipt, Settings, ShoppingBag, Sparkles, Store, Tags, TicketPercent, Truck, UserAdd, Users } from "@/components/ui/icons";

/* Three quiet groups split by a hairline (no group labels): run the shop · shape the catalog · grow. */
const ALL_ITEMS = [
  { href: "/dashboard", key: "home", icon: House, mobile: true, group: 0 },
  { href: "/dashboard/orders", key: "orders", icon: Receipt, mobile: true, group: 0 },
  { href: "/dashboard/products", key: "products", icon: ShoppingBag, mobile: true, group: 0 },
  { href: "/dashboard/analytics", key: "analytics", icon: ChartColumnIncreasing, mobile: false, group: 0 },
  { href: "/dashboard/categories", key: "categories", icon: Tags, mobile: false, group: 1 },
  { href: "/dashboard/discounts", key: "discounts", icon: TicketPercent, mobile: false, group: 1 },
  { href: "/dashboard/delivery", key: "delivery", icon: Truck, mobile: false, group: 1 },
  { href: "/dashboard/payments", key: "payments", icon: CreditCard, mobile: false, group: 1 },
  { href: "/dashboard/customers", key: "customers", icon: Users, mobile: false, group: 1 },
  { href: "/dashboard/ai", key: "ai", icon: Sparkles, mobile: false, group: 2 },
  { href: "/dashboard/theme", key: "theme", icon: Palette, mobile: false, group: 2 },
  { href: "/dashboard/share", key: "share", icon: QrCode, mobile: false, group: 2 },
  { href: "/dashboard/stores", key: "stores", icon: Store, mobile: false, group: 2 },
  { href: "/dashboard/team", key: "team", icon: UserAdd, mobile: false, group: 2 },
  { href: "/dashboard/settings", key: "settings", icon: Settings, mobile: false, group: 2 },
] as const;

type Item = (typeof ALL_ITEMS)[number];

export function DashNav({ variant, newOrders = 0, role = "owner" }: { variant: "side" | "bottom" | "more"; newOrders?: number; role?: "owner" | "staff" }) {
  const t = useTranslations("dash");
  const path = usePathname();
  const badge = (key: string) =>
    key === "orders" && newOrders > 0 ? (
      <span
        data-testid="new-orders-badge"
        aria-label={t("newOrders", { count: newOrders })}
        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-medium leading-none tabular-nums text-white"
      >
        {newOrders > 99 ? "99+" : newOrders}
      </span>
    ) : null;
  // Staff never see owner-only areas (the pages and actions refuse them too).
  const ITEMS = role === "owner" ? ALL_ITEMS : ALL_ITEMS.filter((i) => !isOwnerOnlyPath(i.href));
  const active = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

  if (variant === "bottom") {
    const tab = (on: boolean) =>
      `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150 ${on ? "text-ink" : "text-ink/70 hover:text-ink"}`;
    return (
      <nav aria-label={t("navLabel")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden">
        <ul className="grid grid-cols-4">
          {ITEMS.filter((i) => i.mobile).map((i) => {
            const on = active(i.href);
            return (
              <li key={i.href}>
                <Link href={i.href} aria-current={on ? "page" : undefined} className={tab(on)}>
                  <span className="relative">
                    <Icon as={i.icon} className={`text-[22px] ${on ? "text-gold" : ""}`} />
                    {i.key === "orders" && newOrders > 0 && <span className="absolute -top-1.5 start-3.5">{badge(i.key)}</span>}
                  </span>
                  <span>{t(i.key)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/dashboard/more" aria-current={path === "/dashboard/more" ? "page" : undefined} className={tab(path === "/dashboard/more")}>
              <Icon as={Menu} className={`text-[22px] ${path === "/dashboard/more" ? "text-gold" : ""}`} />
              <span>{t("more")}</span>
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  if (variant === "more") {
    return (
      <nav aria-label={t("navLabel")}>
        <ul className="divide-y divide-line border-y border-line">
          {ITEMS.filter((i) => !i.mobile).map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="group flex min-h-14 items-center gap-4 text-[15px] text-ink">
                <Icon as={i.icon} className="text-xl text-ink/60" />
                <span className="flex-1">{t(i.key)}</span>
                <ChevronForward className="text-ink/40 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const groups = [0, 1, 2].map((g) => ITEMS.filter((i) => i.group === g));
  const row = (i: Item) => {
    const on = active(i.href);
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          aria-current={on ? "page" : undefined}
          className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors duration-150 ${
            on
              ? "bg-white font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)] before:absolute before:inset-y-2.5 before:start-0 before:w-0.5 before:rounded-full before:bg-gold"
              : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
          }`}
        >
          <Icon as={i.icon} className={on ? "text-ink" : ""} />
          <span className="flex-1 truncate">{t(i.key)}</span>
          {badge(i.key)}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={t("navLabel")} className="grid gap-3">
      {groups.map((g, n) => (
        <ul key={n} className={`grid gap-0.5 ${n > 0 ? "border-t border-line pt-3" : ""}`}>
          {g.map(row)}
        </ul>
      ))}
    </nav>
  );
}
