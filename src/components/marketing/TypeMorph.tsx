"use client";
import { useEffect, useRef, useState } from "react";
import { LanguageDropdown } from "@/components/LanguageDropdown";

export type MorphPhrase = { lang: string; dir: "rtl" | "ltr"; label: string; text: string };

/** Split into grapheme clusters so Kurdish/Arabic marks never get cut mid-letter. */
export function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  return Seg ? Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s);
}

/** Typing timings (ms). Exported for the test that pins the auto-cycle. */
export const TM = { firstHold: 1200, hold: 2100, erase: 22, type: 52, gap: 260, afterReveal: 1000, rmStep: 3000 } as const;

/** Resolve once the tile's one-time reveal (RevealObserver, data-rv) has played, or at once when there is none. */
function afterReveal(el: HTMLElement, done: () => void): () => void {
  const card = el.closest<HTMLElement>("[data-rv]");
  const html = document.documentElement;
  if (!card || !html.hasAttribute("data-rv-on") || card.hasAttribute("data-rv-done")) {
    done();
    return () => {};
  }
  let t: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    if (t === undefined) t = setTimeout(done, card.hasAttribute("data-rv-done") ? 0 : TM.afterReveal);
  };
  if (card.hasAttribute("data-rv-in")) {
    arm();
    return () => clearTimeout(t);
  }
  const mo = new MutationObserver(() => {
    if (card.hasAttribute("data-rv-in") || card.hasAttribute("data-rv-done")) {
      mo.disconnect();
      arm();
    }
  });
  mo.observe(card, { attributes: true, attributeFilter: ["data-rv-in", "data-rv-done"] });
  return () => {
    mo.disconnect();
    clearTimeout(t);
  };
}

/**
 * Typewriter morph for the "Kurdish-first" bento tile: the same promise auto-cycles Sorani → Kurmanji → Arabic →
 * English (erase, retype), each line in its own lang/dir so RTL shaping and alignment are right. Server/first paint shows
 * the first phrase in full (no-JS safe). The cycle starts only once the tile is on screen AND its reveal has finished,
 * pauses whenever the tile is off screen or the tab is hidden, and resumes where it stopped. Under
 * prefers-reduced-motion there is no typing: the phrase crossfades to the next language every ~3 s.
 * Height is fixed: every phrase is laid out invisibly in the same grid cell, so the tile is as tall as the longest one
 * and never shifts. Picking a language in the dropdown shows that phrase in full and stops the cycle.
 */
export function TypeMorph({ phrases, label = "Language" }: { phrases: MorphPhrase[]; label?: string }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(false);
  const [count, setCount] = useState(() => graphemes(phrases[0]?.text ?? "").length);
  const [typing, setTyping] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || picked || phrases.length < 2) return;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia: animate */
    }
    let visible = false;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let i = 0;
    let n = graphemes(phrases[0]?.text ?? "").length;
    let phase: "hold" | "erase" | "type" = "hold";
    let first = true;
    const running = () => visible && ready && !document.hidden;
    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };
    const tick = () => {
      if (!running()) return;
      if (reduced) {
        i = (i + 1) % phrases.length;
        setIdx(i);
        setCount(graphemes(phrases[i]!.text).length);
        schedule(TM.rmStep);
        return;
      }
      const g = graphemes(phrases[i]?.text ?? "");
      if (phase === "hold") {
        phase = "erase";
        setTyping(true);
        schedule(TM.erase);
        return;
      }
      if (phase === "erase") {
        n = Math.max(0, n - 1);
        setCount(n);
        if (n === 0) {
          i = (i + 1) % phrases.length;
          setIdx(i);
          phase = "type";
        }
        schedule(n === 0 ? TM.gap : TM.erase);
        return;
      }
      n = Math.min(g.length, n + 1);
      setCount(n);
      if (n === g.length) {
        phase = "hold";
        setTyping(false);
      }
      schedule(n === g.length ? TM.hold : TM.type);
    };
    const resume = () => {
      if (!running()) return;
      const wait = reduced ? TM.rmStep : phase === "hold" ? (first ? TM.firstHold : 900) : 60;
      first = false;
      schedule(wait);
    };
    const stopReveal = afterReveal(el, () => {
      ready = true;
      resume();
    });
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((es) => {
            const was = visible;
            visible = es.some((e) => e.isIntersecting);
            if (visible && !was) resume();
            if (!visible) clearTimeout(timer);
          })
        : null;
    if (io) io.observe(el);
    else visible = true;
    const onVis = () => {
      if (document.hidden) clearTimeout(timer);
      else resume();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!io) resume();
    return () => {
      io?.disconnect();
      stopReveal();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phrases, picked]);

  const p = phrases[idx] ?? phrases[0];
  if (!p) return null;
  const shown = graphemes(p.text).slice(0, count).join("");
  return (
    <div ref={root} className="tm" data-tm data-tm-lang={p.lang} data-tm-typing={typing || undefined}>
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
        {phrases.map((x) => (
          <p key={x.lang} lang={x.lang} dir={x.dir} className="tm-line tm-sizer" aria-hidden="true">
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
