import type { AnnounceTone } from "@/lib/admin";

/** Tailwind classes per tone (literal strings so the CSS is generated; no inline colours). */
export const ANNOUNCE_TONE_CLASS: Record<AnnounceTone, string> = {
  blue: "bg-[#2563EB] text-white",
  ink: "bg-ink text-white",
  green: "bg-[#067647] text-white",
  amber: "bg-[#FEC84B] text-ink",
  red: "bg-[#B42318] text-white",
};

/** Platform-wide announcement (Admin → Site controls). Server or client; no JS. */
export function AnnouncementBar({ text, tone, href }: { text: string; tone: AnnounceTone; href?: string }) {
  const body = <span className="mx-auto block max-w-5xl truncate px-4 py-2 text-center text-[13px] font-medium">{text}{href ? " →" : ""}</span>;
  return (
    <div role="region" aria-label="announcement" data-testid="site-announcement" className={ANNOUNCE_TONE_CLASS[tone] ?? ANNOUNCE_TONE_CLASS.blue}>
      {href ? <a href={href} className="block min-h-9 hover:underline">{body}</a> : body}
    </div>
  );
}
