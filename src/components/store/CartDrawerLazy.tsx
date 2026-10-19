"use client";
import { Suspense, lazy, useEffect, useState } from "react";
import { CART_ADDED, type AddedItem } from "./cart";
import type { CartDrawerLabels } from "./CartDrawer";

const Drawer = lazy(() => import("./CartDrawer").then((m) => ({ default: m.CartDrawer })));

/** Keeps the cart slide-over out of the first-load store bundle: the real drawer loads on the first add-to-cart and opens with that item. */
export function CartDrawerLazy({ slug, labels }: { slug: string; labels: CartDrawerLabels }) {
  const [first, setFirst] = useState<AddedItem | null>(null);
  useEffect(() => {
    if (first) return;
    const on = (e: Event) => setFirst((e as CustomEvent<AddedItem>).detail);
    window.addEventListener(CART_ADDED, on);
    return () => window.removeEventListener(CART_ADDED, on);
  }, [first]);
  if (!first) return null;
  return (
    <Suspense fallback={null}>
      <Drawer slug={slug} labels={labels} initial={first} />
    </Suspense>
  );
}
