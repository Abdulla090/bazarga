"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Link to the current store's home (/s/{slug}) for boundaries that get no params (the storefront 404). */
export function StoreHomeLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const home = (usePathname() ?? "/").split("/").slice(0, 3).join("/") || "/";
  return (
    <Link href={home} className={className}>
      {children}
    </Link>
  );
}
