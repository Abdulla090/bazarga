import { Fragment, type CSSProperties } from "react";

/**
 * Server-safe helpers for the landing's one-time reveals (CSS: marketing.css "ONE-TIME REVEALS"; JS: RevealObserver).
 * Nothing here hides content by itself: the hidden start states only apply once RevealObserver sets html[data-rv-on].
 */
export type RevealKind = "e" | "h" | "t" | "c" | "m" | "p";

/** Spread onto an element: `<p {...rv("t", 120)}>`. `delay` is ms after the element enters the viewport. */
export function rv(kind: RevealKind, delay = 0, style?: CSSProperties) {
  return {
    "data-rv": kind,
    style: delay ? ({ ...style, "--rv-d": `${delay}ms` } as CSSProperties) : style,
  } as const;
}

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Split a heading into words for the word-by-word blur rise. Each word becomes an inline-block, which the bidi
 * algorithm treats as one neutral object, so in Arabic-script text (Sorani / Arabic) runs of consecutive non-Arabic
 * words ("Reelcart Pro", "#1042") are kept in ONE box to keep their visual order. Splits only at spaces, so Arabic
 * letter joining is untouched.
 */
export function splitWords(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!ARABIC_SCRIPT.test(text)) return tokens;
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (prev !== undefined && !ARABIC_SCRIPT.test(t) && !ARABIC_SCRIPT.test(prev)) out[out.length - 1] = `${prev} ${t}`;
    else out.push(t);
  }
  return out;
}

/** Heading text as `.rv-w` word spans (use inside an element with `{...rv("h")}`). Text content is unchanged. */
export function Words({ text, start = 0 }: { text: string; start?: number }) {
  const words = splitWords(text);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="rv-w" style={{ "--w": i + start } as CSSProperties}>{w}</span>
        </Fragment>
      ))}
    </>
  );
}
