function lin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(h: string): number {
  const [r, g, b] = rgb(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const x = Math.max(la, lb), y = Math.min(la, lb);
  return (x + 0.05) / (y + 0.05);
}
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export function mix(a: string, b: string, t: number): string {
  const [p, q] = [rgb(a), rgb(b)];
  return toHex(p.map((v, i) => v + ((q[i] ?? 0) - v) * t));
}
/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#0A0A0B") ? "#FFFFFF" : "#0A0A0B";
}
/** Nudge `fg` toward black/white until it reaches `min` contrast on `bg`. */
export function ensureContrast(fg: string, bg: string, min = 4.5): { color: string; fixed: boolean } {
  if (contrast(fg, bg) >= min) return { color: fg, fixed: false };
  const target = luminance(bg) > 0.5 ? "#000000" : "#FFFFFF";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(fg, target, t);
    if (contrast(c, bg) >= min) return { color: c, fixed: true };
  }
  return { color: target, fixed: true };
}
