"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, House, Icon, Menu, Receipt, Settings, ShoppingBag, Sparkles, Tags, TicketPercent, Truck, Users } from "@/components/ui/icons";

const ITEMS = [
  { href: "/dashboard", key: "home", icon: House, mobile: true },
  { href: "/dashboard/orders", key: "orders", icon: Receipt, mobile: true },
  { href: "/dashboard/products", key: "products", icon: ShoppingBag, mobile: true },
  { href: "/dashboard/ai", key: "ai", icon: Sparkles, mobile: false },
  { href: "/dashboard/categories", key: "categories", icon: Tags, mobile: false },
  { href: "/dashboard/delivery", key: "delivery", icon: Truck, mobile: false },
  { href: "/dashboard/discounts", key: "discounts", icon: TicketPercent, mobile: false },
  { href: "/dashboard/payments", key: "payments", icon: CreditCard, mobile: false },
  { href: "/dashboard/customers", key: "customers", icon: Users, mobile: false },
  { href: "/dashboard/settings", key: "settings", icon: Settings, mobile: false },
] as const;

export function DashNav({ variant }: { variant: "side" | "bottom" | "more" }) {
  const t = useTranslations("dash");
  const path = usePathname();
  const active = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

  if (variant === "bottom") {
    return (
      <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        <ul className="grid grid-cols-4">
          {ITEMS.filter((i) => i.mobile).map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center text-xs font-semibold ${active(i.href) ? "text-ink" : "text-ink-50"}`}>
                <Icon as={i.icon} className="text-xl" />
                {t(i.key)}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/dashboard/more" aria-current={path === "/dashboard/more" ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center text-xs font-semibold ${path === "/dashboard/more" ? "text-ink" : "text-ink-50"}`}>
              <Icon as={Menu} className="text-xl" />
              {t("more")}
            </Link>
          </li>
        </ul>
      </nav>
    );
  }
  const list = variant === "more" ? ITEMS.filter((i) => !i.mobile) : ITEMS;
  return (
    <nav aria-label="Dashboard">
      <ul className="grid gap-1">
        {list.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold ${active(i.href) ? "bg-ink text-paper" : "text-ink-70 hover:bg-ink/5"}`}
            >
              <Icon as={i.icon} />
              {t(i.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
