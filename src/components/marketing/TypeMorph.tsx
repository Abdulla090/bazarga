"use client";
import { useEffect, useRef, useState } from "react";
import { LanguageDropdown } from "@/components/LanguageDropdown";

export type MorphPhrase = { lang: string; dir: "rtl" | "ltr"; label: string; text: string };

/** Split into grapheme clusters so Kurdish/Arabic marks never get cut mid-letter. */
export function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  return Seg ? Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s);
}

/**
 * Timings (ms). `step` is one language: the CSS fallback (marketing.css `tm-cycle`, 4 × 3 s) uses the same rhythm.
 * Exported for the test that pins the auto-cycle.
 */
export const TM = { step: 3000, type: 38 } as const;

/**
 * Language demo for the "your language first" bento tile: the same promise cycles through the four store languages,
 * starting with the visitor's own, each line in its own lang/dir so RTL shaping and alignment are right.
 *
 * Oct 18 (Abdulla's Android, ar): the old version only started after a chain of gates — hydration, an
 * IntersectionObserver "visible" callback, AND the card's one-time reveal reaching data-rv-in/done — and all of it
 * lived in JS. When the island's JS doesn't run or never gets past a gate on a real phone, the tile sits still.
 * Now it is two independent layers:
 *  1. CSS (no JS needed): until this component mounts, the four phrases crossfade on a 12 s keyframe loop
 *     (`.tm:not([data-tm-js]) .tm-sizer`), reduced motion included.
 *  2. JS: on mount a plain setInterval advances one language every 3 s (types it in; crossfade only under reduced
 *     motion). It pauses ONLY while the tab is hidden, or while an IntersectionObserver has positively reported the
 *     tile off screen; if IO never fires it simply keeps running. No reveal/animationend/transitionend gating.
 * Height is fixed: every phrase is laid out in the same grid cell, so the tile is as tall as the longest one. Picking a
 * language in the dropdown shows that phrase and stops the cycle.
 */
export function TypeMorph({ phrases, label = "Language" }: { phrases: MorphPhrase[]; label?: string }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(false);
  const [js, setJs] = useState(false);
  const [count, setCount] = useState(() => graphemes(phrases[0]?.text ?? "").length);
  const [typing, setTyping] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (picked || phrases.length < 2) return;
    const el = root.current;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia: type */
    }
    // Continue from the phrase the CSS loop is showing right now, so taking over is seamless.
    let i = 0;
    let firstWait: number = TM.step;
    try {
      const a = el?.querySelector<HTMLElement>(".tm-sizer")?.getAnimations?.()[0];
      const t = typeof a?.currentTime === "number" ? a.currentTime : null;
      if (t !== null) {
        i = Math.floor((t % (TM.step * phrases.length)) / TM.step) % phrases.length;
        firstWait = Math.max(400, TM.step - (t % TM.step)); // keep the CSS loop's rhythm: no 3 s restart at hydration
      }
    } catch {
      /* no Web Animations: start at the visitor's language */
    }
    setIdx(i);
    setCount(graphemes(phrases[i]!.text).length);
    setJs(true);

    let offscreen = false;
    let typer: ReturnType<typeof setInterval> | undefined;
    const stopTyping = () => {
      clearInterval(typer);
      typer = undefined;
      setTyping(false);
    };
    const advance = () => {
      if (document.hidden || offscreen) return;
      i = (i + 1) % phrases.length;
      const len = graphemes(phrases[i]!.text).length;
      stopTyping();
      setIdx(i);
      if (reduced) {
        setCount(len);
        return;
      }
      let n = 0;
      setCount(0);
      setTyping(true);
      typer = setInterval(() => {
        n += 1;
        setCount(n);
        if (n >= len) stopTyping();
      }, TM.type);
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const kick = setTimeout(() => {
      advance();
      timer = setInterval(advance, TM.step);
    }, firstWait);

    let io: IntersectionObserver | null = null;
    try {
      if (el && typeof IntersectionObserver === "function") {
        io = new IntersectionObserver((es) => {
          const e = es[es.length - 1];
          if (e) offscreen = !e.isIntersecting;
        });
        io.observe(el);
      }
    } catch {
      io = null;
    }
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
      clearInterval(typer);
      io?.disconnect();
    };
  }, [phrases, picked]);

  const p = phrases[idx] ?? phrases[0];
  if (!p) return null;
  const shown = graphemes(p.text).slice(0, count).join("");
  return (
    <div
      ref={root}
      className="tm"
      data-tm
      data-tm-js={js || undefined}
      data-tm-lang={p.lang}
      data-tm-typing={typing || undefined}
      style={{ "--tm-n": phrases.length } as React.CSSProperties}
    >
      <div className="tm-bar">
        <LanguageDropdown
          tone="light"
          label={label}
          items={phrases.map((x) => ({ value: x.lang, label: x.label, lang: x.lang, dir: x.dir }))}
          value={p.lang}
          onSelect={(v) => {
            const i = phrases.findIndex((x) => x.lang === v);
            if (i < 0) return;
            setPicked(true);
            setTyping(false);
            setIdx(i);
            setCount(graphemes(phrases[i]!.text).length);
          }}
        />
      </div>
      <div className="tm-stage">
        {phrases.map((x, k) => (
          <p
            key={x.lang}
            lang={x.lang}
            dir={x.dir}
            className="tm-line tm-sizer"
            aria-hidden="true"
            style={{ "--k": k } as React.CSSProperties}
          >
            {x.text}
            <span className="tm-caret" />
          </p>
        ))}
        <p key={p.lang} lang={p.lang} dir={p.dir} className="tm-line tm-live" aria-live="off" data-tm-line>
          <span>{shown}</span>
          <span className="tm-caret" />
        </p>
      </div>
    </div>
  );
}
