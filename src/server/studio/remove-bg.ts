import "server-only";
import { logger } from "../logger";

/**
 * Optional AI background removal for Product Studio (SF9): remove.bg with the operator's REMOVE_BG_API_KEY. Without
 * the key Product Studio still works with the free in-browser cleanup (src/lib/studio/process.ts).
 * Returns a PNG on a white background, or null when the call failed.
 */
export const removeBgOn = (key?: string) => !!key;

export async function removeBackground(file: Blob, key: string, fetchImpl: typeof fetch = fetch): Promise<Blob | null> {
  const fd = new FormData();
  fd.append("image_file", file, "photo");
  fd.append("size", "auto");
  fd.append("bg_color", "ffffff");
  fd.append("format", "png");
  try {
    const res = await fetchImpl("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": key }, body: fd, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      logger.warn("studio.removebg_failed", { status: res.status });
      return null;
    }
    return await res.blob();
  } catch {
    return null;
  }
}
