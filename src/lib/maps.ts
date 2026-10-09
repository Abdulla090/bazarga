/** Google Maps search link for a delivery address (landmark-based addresses work well in search). */
export function mapsLink(...parts: Array<string | null | undefined>): string {
  const q = parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
