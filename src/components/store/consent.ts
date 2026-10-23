export const CONSENT_KEY = "bz-pixel-consent";

/** True unless the shopper declined the seller's ad pixels. */
export function pixelsConsented(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) !== "no";
  } catch {
    return true;
  }
}
