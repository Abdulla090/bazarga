import Link from "next/link";
import { ArrowForward } from "@/components/ui/icons";

/**
 * Hero primary CTA: a restrained ink pill (same family as .btn-ink), 48px tall, with a sliding direction-aware arrow.
 * The headline's blue "Start free." line is the hook, so the button stays quiet. Styles: globals.css .cta-hook.
 */
export function HeroCta({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} data-hero-cta className="cta-hook group">
      <span className="min-w-0 truncate">{label}</span>
      <ArrowForward className="cta-arrow shrink-0 text-lg" />
    </Link>
  );
}

/** Headline line 2: blue gradient text fill + one-time hand-drawn underline (globals.css .hero-hook). */
export function HeroHook({ text }: { text: string }) {
  return (
    <span data-hero-hook className="hero-hook">
      <span className="hero-hook-text">{text}</span>
      <svg aria-hidden="true" focusable="false" className="hero-hook-line" viewBox="0 0 300 12" preserveAspectRatio="none">
        <path d="M3 8.5C55 4.2 118 3.1 178 4.4c42 .9 80 2.6 119 4.6" pathLength="1" />
      </svg>
    </span>
  );
}
