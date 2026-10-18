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


/*
 * Store-design display faces (Editorial). Loaded without preload so dashboards and other designs never pay for them;
 * the browser fetches a face only when a page's text falls in its unicode-range.
 * Fraunces (OFL-1.1): Latin display serif. Noto Naskh Arabic (OFL-1.1): the serif Arabic/Kurdish/Persian script to pair.
 */
export const fraunces = localFont({
  src: "./fonts/fraunces-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-fraunces",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
  adjustFontFallback: false,
});

export const frauncesExt = localFont({
  src: "./fonts/fraunces-latin-ext-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-fraunces-ext",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
  adjustFontFallback: false,
});

export const naskh = localFont({
  src: "./fonts/noto-naskh-arabic-arabic-wght-normal.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-naskh",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
  adjustFontFallback: false,
});


/*
 * Theme type pairs (docs/DESIGN-SYSTEM.md "Typography"). Every face is preload: false and unicode-range limited, so a
 * store only downloads the faces its theme names, and only for the scripts on the page. Arabic-script partners were
 * checked for the Sorani letters (ڕ ڵ ۆ ێ ە ڤ ھ) and harakat: Noto Kufi Arabic (variable) and IBM Plex Sans Arabic
 * (400/700), both subset to the Arabic block. Rubik and Readex Pro were rejected (no ڕ/ڵ). All OFL-1.1.
 */
export const playfair = localFont({
  src: "./fonts/playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  style: "normal",
  display: "swap",
  variable: "--font-playfair",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
  adjustFontFallback: false,
});
export const oswald = localFont({
  src: "./fonts/oswald-latin-wght-normal.woff2",
  weight: "200 700",
  style: "normal",
  display: "swap",
  variable: "--font-oswald",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
  adjustFontFallback: false,
});
export const oswaldExt = localFont({
  src: "./fonts/oswald-latin-ext-wght-normal.woff2",
  weight: "200 700",
  style: "normal",
  display: "swap",
  variable: "--font-oswald-ext",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
  adjustFontFallback: false,
});
export const grotesk = localFont({
  src: "./fonts/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--font-grotesk",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
  adjustFontFallback: false,
});
export const groteskExt = localFont({
  src: "./fonts/space-grotesk-latin-ext-wght-normal.woff2",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--font-grotesk-ext",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
  adjustFontFallback: false,
});
export const jetbrains = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-jetbrains",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
  adjustFontFallback: false,
});
export const nunito = localFont({
  src: "./fonts/nunito-latin-wght-normal.woff2",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  variable: "--font-nunito",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
  adjustFontFallback: false,
});
export const nunitoExt = localFont({
  src: "./fonts/nunito-latin-ext-wght-normal.woff2",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  variable: "--font-nunito-ext",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
  adjustFontFallback: false,
});
export const kufi = localFont({
  src: "./fonts/noto-kufi-arabic-arabic-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-kufi",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+200C-200E, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
  adjustFontFallback: false,
});
export const plexArabic = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plex-arabic",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+200C-200E, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
  adjustFontFallback: false,
});

/** Class names that define the font CSS variables; put on <html>. */
export const fontVariables = [vazirmatn.variable, inter.variable, interExt.variable, fraunces.variable, frauncesExt.variable, naskh.variable, playfair.variable, oswald.variable, oswaldExt.variable, grotesk.variable, groteskExt.variable, jetbrains.variable, nunito.variable, nunitoExt.variable, kufi.variable, plexArabic.variable].join(" ");
