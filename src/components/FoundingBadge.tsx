import { Gem, Icon } from "@/components/ui/icons";

/** "Founding seller #12" pill (label + number) (docs/DEMAND.md D3). Blue ring on ink-or-inherit text; the number is its own LTR island so RTL keeps "#12" intact. */
export function FoundingBadge({ label, number, className = "" }: { label: string; number: number; className?: string }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#2563EB]/40 bg-[#2563EB]/[0.07] px-3 text-xs font-semibold text-[#2563EB] ${className}`}
      data-founding-badge={number}
      title={`${label} #${number}`}
    >
      <Icon as={Gem} className="h-3.5 w-3.5" />
      <span>{label}</span>
      <bdi dir="ltr" className="num">#{number}</bdi>
    </span>
  );
}
