import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every `btn-*` / `card`-style custom utility used in markup must exist in globals.css (a typo renders an unstyled link). */
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

describe("custom button classes", () => {
  it("only uses btn-* utilities that globals.css defines", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const defined = new Set([...css.matchAll(/@utility (btn(?:-[a-z0-9]+)?)\b/g)].map((m) => m[1]));
    const used = new Map<string, string>();
    for (const file of walk("src")) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/(?<![\w-])(btn-[a-z][a-z0-9]*)(?![\w-])/g)) if (!used.has(m[1])) used.set(m[1], file);
    }
    const undefinedUsed = [...used].filter(([c]) => !defined.has(c) && !css.includes(`.${c}`)).map(([c, f]) => `${c} (${f})`);
    expect(undefinedUsed).toEqual([]);
  });
});
