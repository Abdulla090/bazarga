type Props = { className?: string; showKu?: boolean; tone?: "ink" | "paper" };

/** Lowercase "my market" wordmark + gold scalloped shop awning, paired with فرۆشگاکەم. */
export function Logo({ className = "", showKu = true, tone = "ink" }: Props) {
  const color = tone === "ink" ? "text-ink" : "text-paper";
  return (
    <span className={`inline-flex items-end gap-2 ${color} ${className}`} aria-label="my market · فرۆشگاکەم">
      <span className="relative inline-flex flex-col items-start" dir="ltr">
        <Awning className="mb-0.5 h-3.5 w-9" />
        <span className="font-latin text-xl font-extrabold leading-none tracking-tight">
          my market
        </span>
      </span>
      {showKu && <span className="pb-px text-sm font-bold opacity-80" lang="ckb">فرۆشگاکەم</span>}
    </span>
  );
}

export function Awning({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 16" className={className} aria-hidden="true">
      <path d="M3 0h34l3 7H0z" fill="#F5B700" />
      <path
        d="M0 7h40v2a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0z"
        fill="#F5B700"
      />
      <path d="M10 0h5l-2 7h-5zM25 0h5l2 7h-5z" fill="#0F1B2D" opacity=".18" />
    </svg>
  );
}
