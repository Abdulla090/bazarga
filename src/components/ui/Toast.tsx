import type { ReactNode } from "react";

export function Toast({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div role="status" aria-live="polite" className={tone === "danger" ? "toast-danger" : "toast"}>
      {children}
    </div>
  );
}

export function Sheet({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="dialog" aria-label={label} className="sheet">
      {children}
    </div>
  );
}
