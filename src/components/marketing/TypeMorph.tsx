"use client";
import { useEffect, useRef, useState } from "react";
import { LanguageDropdown } from "@/components/LanguageDropdown";

export type MorphPhrase = { lang: string; dir: "rtl" | "ltr"; label: string; text: string };

/** Split into grapheme clusters so Kurdish/Arabic marks never get cut mid-letter. */
function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  return Seg ? Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s);
}

/**
 * Typewriter morph for the "Kurdish-first" bento tile: the same phrase cycles Sorani → Kurmanji → Arabic → English,
 * each line in its own lang/dir so RTL shaping and alignment are correct. Server/first paint shows the first phrase in
 * full (no layout jump, no-JS safe); it starts erasing only after a hold and only while on screen. Under
 * prefers-reduced-motion it never animates. The language picker is the shared compact dropdown (direction-aware, tidy at
 * 360px): it follows the cycle, and picking a language shows that phrase in full and stops the auto-cycle.
 */
export function TypeMorph({ phrases, label = "Language" }: { phrases: MorphPhrase[]; label?: string }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(false);
  const [count, setCount] = useState(() => graphemes(phrases[0]?.text ?? "").length);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || picked || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let i = 0;
    let n = graphemes(phrases[0]?.text ?? "").length;
    let phase: "hold" | "erase" | "type" = "hold";
    const tick = () => {
      if (!visible || document.hidden) return;
      const g = graphemes(phrases[i]?.text ?? "");
      if (phase === "hold") {
        phase = "erase";
        timer = setTimeout(tick, 34);
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
        timer = setTimeout(tick, n === 0 ? 260 : 22);
        return;
      }
      n = Math.min(g.length, n + 1);
      setCount(n);
      if (n === g.length) phase = "hold";
      timer = setTimeout(tick, n === g.length ? 2100 : 52);
    };
    const io = new IntersectionObserver((es) => {
      const was = visible;
      visible = es.some((e) => e.isIntersecting);
      if (visible && !was) {
        clearTimeout(timer);
        timer = setTimeout(tick, phase === "hold" ? 1600 : 60);
      }
      if (!visible) clearTimeout(timer);
    });
    io.observe(el);
    const onVis = () => {
      if (!document.hidden && visible) {
        clearTimeout(timer);
        timer = setTimeout(tick, 400);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phrases, picked]);

  const p = phrases[idx] ?? phrases[0];
  if (!p) return null;
  const shown = graphemes(p.text).slice(0, count).join("");
  return (
    <div ref={root} className="tm" data-tm>
      <div className="tm-bar">
        <LanguageDropdown
          tone="dark"
          label={label}
          items={phrases.map((x) => ({ value: x.lang, label: x.label, lang: x.lang, dir: x.dir }))}
          value={p.lang}
          onSelect={(v) => {
            const i = phrases.findIndex((x) => x.lang === v);
            if (i < 0) return;
            setPicked(true);
            setIdx(i);
            setCount(graphemes(phrases[i]!.text).length);
          }}
        />
      </div>
      <p lang={p.lang} dir={p.dir} className="tm-line" aria-live="off">
        <span>{shown}</span>
        <span className="tm-caret" />
      </p>
    </div>
  );
}
