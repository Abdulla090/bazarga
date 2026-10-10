"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_ADDED, useCart } from "./cart";
import { Icon, ShoppingBag } from "@/components/ui/icons";

/** Header cart: a 44 px icon button with an ink count dot (no label text — the aria-label carries it). */
export function CartLink({ slug, label }: { slug: string; label: string }) {
  const { count } = useCart(slug);
  // Re-keying the dot replays its bump keyframe on every add (not on page load).
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const on = () => setBump((n) => n + 1);
    window.addEventListener(CART_ADDED, on);
    return () => window.removeEventListener(CART_ADDED, on);
  }, []);
  return (
    <Link
      href={`/s/${slug}/cart`}
      className="relative -me-2 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-st-fg/5"
      aria-label={count ? `${label} (${count})` : label}
      data-testid="cart-link"
    >
      <Icon as={ShoppingBag} className="h-[22px] w-[22px]" />
      {count > 0 && (
        <span key={bump} className={`num absolute end-0.5 top-0.5 ${bump ? "cart-bump" : ""} flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-st-fg px-1 text-[11px] font-medium leading-none text-st-bg`} data-testid="cart-count">
          {count}
        </span>
      )}
    </Link>
  );
}
