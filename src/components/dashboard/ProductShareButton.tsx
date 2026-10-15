"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, Share2 } from "@/components/ui/icons";
import type { ProductShareProps } from "./ProductShareModal";

// The modal (canvas drawing, caption generator) is its own chunk, fetched on the first tap only.
const ProductShareModal = dynamic(() => import("./ProductShareModal").then((m) => m.ProductShareModal), { ssr: false });

/** Per-product "Share" in the dashboard product list (docs/SOCIAL-FIRST.md S3). */
export function ProductShareButton(props: Omit<ProductShareProps, "onClose">) {
  const t = useTranslations("productShare");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-ink/30"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="product-share"
      >
        <Icon as={Share2} />
        <span className="max-sm:sr-only">{t("share")}</span>
      </button>
      {open && <ProductShareModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
