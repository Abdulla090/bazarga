// "Save my details": name/phone/landmark remembered on the shopper's device only (never sent anywhere).
export const SAVED_DETAILS_KEY = "bz_details_v1";
export type SavedDetails = { name: string; phone: string; landmark: string };

export function serializeDetails(d: Partial<SavedDetails>): string {
  const clean = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  return JSON.stringify({ name: clean(d.name, 80), phone: clean(d.phone, 17), landmark: clean(d.landmark, 200) });
}

export function parseDetails(raw: string | null | undefined): SavedDetails | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
    const d = { name: s(o.name, 80), phone: s(o.phone, 17), landmark: s(o.landmark, 200) };
    return d.name || d.phone || d.landmark ? d : null;
  } catch {
    return null;
  }
}
