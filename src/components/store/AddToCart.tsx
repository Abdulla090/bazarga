"use client";
import { useState } from "react";
import { useCart } from "./cart";

export type AddToCartLabels = { add: string; added: string; soldOut: string };

/** Card "Add to cart" for simple products (desktop hover pill; products with variants link to their page instead). */
export function AddToCart({
  slug,
  productId,
  disabled,
  labels,
}: {
  slug: string;
  productId: string;
  disabled?: boolean;
  labels: AddToCartLabels;
}) {
  const { add } = useCart(slug);
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      className="btn-ghost btn-sm relative z-10 min-h-9 border-transparent bg-st-surface/95 px-4 shadow-e1 backdrop-blur"
      onClick={() => {
        add({ productId });
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      <span aria-live="polite">{disabled ? labels.soldOut : added ? labels.added : labels.add}</span>
    </button>
  );
}
