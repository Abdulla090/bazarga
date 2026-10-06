"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCart } from "./cart";

export function CartLink({ slug }: { slug: string }) {
  const t = useTranslations("store");
  const { count } = useCart(slug);
  return (
    <Link href={`/s/${slug}/cart`} className="btn-gold btn-sm relative">
      🛒 {t("cart")}
      {count > 0 && <span className="num rounded-full bg-ink px-2 text-xs text-paper">{count}</span>}
    </Link>
  );
}
