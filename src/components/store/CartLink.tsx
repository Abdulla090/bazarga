"use client";
import Link from "next/link";
import { useCart } from "./cart";
import { Icon, ShoppingCart } from "@/components/ui/icons";

export function CartLink({ slug, label }: { slug: string; label: string }) {
  const { count } = useCart(slug);
  return (
    <Link href={`/s/${slug}/cart`} className="btn-gold btn-sm relative" aria-label={count ? `${label} (${count})` : label}>
      <Icon as={ShoppingCart} /> <span className="hidden min-[380px]:inline">{label}</span>
      {count > 0 && <span className="num rounded-full bg-ink px-2 text-xs text-paper">{count}</span>}
    </Link>
  );
}
