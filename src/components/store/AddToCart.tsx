"use client";
import { useEffect, useRef, useState } from "react";
import { announceAdded, useCart, type AddedItem } from "./cart";

export type AddToCartLabels = { add: string; added: string; soldOut: string };

/** Card "Add to cart" for simple products (desktop hover pill; products with variants link to their page instead). */
export function AddToCart({
  slug,
  productId,
  disabled,
  labels,
  item,
  className = "btn-ghost btn-sm relative z-10 min-h-9 border-transparent bg-st-surface/95 px-4 shadow-e1 backdrop-blur",
  icon,
}: {
  slug: string;
  productId: string;
  disabled?: boolean;
  labels: AddToCartLabels;
  /** Shown in the "Added to cart" drawer. */
  item?: Omit<AddedItem, "qty">;
  className?: string;
  /** Icon-only button (compact cards): the label moves to aria-label. */
  icon?: React.ReactNode;
}) {
  const { add } = useCart(slug);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      aria-label={icon ? (disabled ? labels.soldOut : added ? labels.added : labels.add) : undefined}
      onClick={() => {
        add({ productId });
        if (item) announceAdded({ ...item, qty: 1 });
        setAdded(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setAdded(false), 1200);
      }}
    >
      {icon ? <span aria-hidden>{icon}</span> : <span aria-live="polite">{disabled ? labels.soldOut : added ? labels.added : labels.add}</span>}
    </button>
  );
}
