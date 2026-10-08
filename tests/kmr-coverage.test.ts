import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import kmr from "../messages/kmr.json";

type Json = { [k: string]: Json | string };

function flat(o: Json, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith("_")) continue;
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flat(v, `${prefix}${k}.`));
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{[^}]*\}/g) ?? []).sort();
const E = flat(en as Json);
const K = flat(kmr as Json);

describe("Kurmanji (kmr) messages", () => {
  it("translates every key English has, with no stray keys", () => {
    expect(Object.keys(E).filter((k) => !(k in K))).toEqual([]);
    expect(Object.keys(K).filter((k) => !(k in E))).toEqual([]);
  });

  it("keeps every {placeholder} the English string has (bioLine carries a raw {url})", () => {
    const bad = Object.keys(K).filter((k) => k in E && placeholders(E[k]).join() !== placeholders(K[k]).join());
    expect(bad).toEqual([]);
  });

  it("is real Latin-script Kurmanji, not copied English or Sorani", () => {
    const arabicScript = /[\u0600-\u06FF]/;
    // ai.messagePlaceholder is a deliberate Sorani example prompt.
    const stray = Object.keys(K).filter((k) => k !== "ai.messagePlaceholder" && arabicScript.test(K[k]));
    expect(stray).toEqual([]);
    const sameAsEnglish = Object.keys(K).filter((k) => K[k] === E[k] && /[a-z]{4,}/i.test(K[k]));
    // Brand names / codes may legitimately match (Bazarga, FastPay, Qi Card, ZainCash, Instagram, WhatsApp, Logo, Kod...).
    expect(sameAsEnglish.length).toBeLessThan(15);
  });

  it("ku and ar stay in step with English too", () => {
    for (const m of [ku, ar]) {
      const M = flat(m as Json);
      expect(Object.keys(E).filter((k) => !(k in M))).toEqual([]);
    }
  });
});
