"use client";

/** Opens the browser print dialog (packing slip). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-gold" data-testid="print-slip" onClick={() => window.print()}>
      {label}
    </button>
  );
}
