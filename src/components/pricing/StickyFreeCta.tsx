"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Mobile-only bar that appears after the hero scrolls away. */
export function StickyFreeCta() {
  const t = useTranslations("pricing");
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 520);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 motion-reduce:transition-none md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <Link href="/signup" tabIndex={show ? 0 : -1} className="flex min-h-12 items-center justify-center rounded-full bg-[#2563EB] px-5 text-sm font-semibold text-white">
        {t("sticky")}
      </Link>
    </div>
  );
}
