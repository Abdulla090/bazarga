import localFont from "next/font/local";

/*
 * Self-hosted variable fonts via next/font (no runtime or build-time call to Google; works offline and in CI).
 * Files: subsets of Vazirmatn (OFL-1.1) and Inter (OFL-1.1), copied from @fontsource-variable — licences next to them.
 * Each face carries its unicode-range, so a page only downloads the scripts it actually renders:
 *   Sorani/Arabic page → Vazirmatn (Arabic block) + Inter Latin for digits/Latin words,
 *   English page → Inter Latin; Kurmanji "ş"/"Ş" pull in Inter Latin-Ext on demand.
 * Fallback-metric faces are off on purpose: they would cover Latin before Inter in the Kurdish stack (and Latin-Ext
 * before InterExt in the English one). font-display: swap + the system stack in globals.css cover the gap.
 * next/font options must be literals (statically analysed by the compiler) — hence the inline unicode ranges.
 */
export const vazirmatn = localFont({
  src: "./fonts/vazirmatn-arabic-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-vazirmatn",
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],

  adjustFontFallback: false,
});

export const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],

  adjustFontFallback: false,
});

export const interExt = localFont({
  src: "./fonts/inter-latin-ext-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter-ext",
  // Only Kurmanji/Turkish-specific letters need this file — don't preload it.
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
  adjustFontFallback: false,
});

/** Class names that define the three CSS variables; put on <html>. */
export const fontVariables = [vazirmatn.variable, inter.variable, interExt.variable].join(" ");
