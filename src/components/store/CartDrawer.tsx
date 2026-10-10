"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CART_ADDED, useCart, type AddedItem } from "./cart";
import { Check, Icon, X } from "@/components/ui/icons";

export type CartDrawerLabels = { added: string; viewCart: string; checkout: string; continue: string; close: string; inCart: string };

/**
 * "Added to cart" slide-over (Layout v3 §7, NN/g cart feedback): a native modal <dialog> — top layer, focus trap,
 * Esc and focus return come from the browser — sliding in from the inline end on desktop and up as a sheet on phones.
 * Shows the photo, name, options, quantity × price and two exits; it stays until dismissed (never times out).
 * Opened by the `mm:cart-added` window event that every add-to-cart control fires.
 */
export function CartDrawer({ slug, labels }: { slug: string; labels: CartDrawerLabels }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState<AddedItem | null>(null);
  const { count } = useCart(slug);

  useEffect(() => {
    const onAdded = (e: Event) => {
      setItem((e as CustomEvent<AddedItem>).detail);
      const d = ref.current;
      if (d && !d.open) d.showModal();
    };
    window.addEventListener(CART_ADDED, onAdded);
    return () => window.removeEventListener(CART_ADDED, onAdded);
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="cart-drawer"
      aria-labelledby="cart-drawer-h"
      data-testid="cart-drawer"
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself (its content box is fully covered by the panel).
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="cart-drawer-h" className="t-title flex items-center gap-2">
            <Icon as={Check} className="h-5 w-5" />
            {labels.added}
          </h2>
          <button type="button" onClick={close} aria-label={labels.close} className="-me-2 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-st-fg/5">
            <Icon as={X} className="h-5 w-5" />
          </button>
        </div>
        {item && (
          <div className="flex items-center gap-4 border-y border-st-border py-5">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-24 w-[4.8rem] shrink-0 rounded-xl bg-[#F4F4F5] object-cover" />
            ) : (
              <span className="h-24 w-[4.8rem] shrink-0 rounded-xl bg-[#F4F4F5]" />
            )}
            <div className="grid min-w-0 gap-1">
              <p className="line-clamp-2 text-[15px] leading-snug">{item.name}</p>
              {item.variant && <p className="truncate text-[13px] text-muted">{item.variant}</p>}
              <p className="num text-sm font-medium">
                {item.qty > 1 && <span className="text-muted">{item.qty} × </span>}
                {item.price}
              </p>
            </div>
          </div>
        )}
        <p className="t-label text-muted" aria-live="polite">{labels.inCart.replace("{count}", String(count))}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/s/${slug}/cart`} onClick={close} className="btn-ghost min-h-12 w-full">{labels.viewCart}</Link>
          <Link href={`/s/${slug}/cart#checkout`} onClick={close} className="btn-gold min-h-12 w-full" data-testid="drawer-checkout">{labels.checkout}</Link>
        </div>
        <button type="button" onClick={close} className="mx-auto inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
          {labels.continue}
        </button>
      </div>
    </dialog>
  );
}
