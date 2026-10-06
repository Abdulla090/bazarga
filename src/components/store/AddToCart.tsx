"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "./cart";

export function AddToCart({ slug, productId, disabled, big = false }: { slug: string; productId: string; disabled?: boolean; big?: boolean }) {
  const t = useTranslations("store");
  const { add } = useCart(slug);
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      className={big ? "btn-gold w-full" : "btn-gold btn-sm w-full"}
      onClick={() => {
        add(productId);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {disabled ? t("outOfStock") : added ? t("added") : t("addToCart")}
    </button>
  );
}
