/** Origin of the public image host (S3/R2 public URL), or null for same-origin/invalid values. Used for preconnect. */
export function imageOrigin(publicUrl: string | undefined | null): string | null {
  if (!publicUrl) return null;
  try {
    const u = new URL(publicUrl.trim());
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}
