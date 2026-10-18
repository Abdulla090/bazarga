import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { composeDesign, decodeComposition, type DesignSpec } from "@/lib/theme-studio/designs";
import { parseTheme } from "@/lib/theme-studio/resolve";
import { FLAGSHIPS, isFlagshipId } from "@/lib/theme-studio/themes";
import type { StoreTheme } from "@/lib/theme-studio/schema";
import { hasFeature, normalizePlan } from "@/lib/plans";
import { PREVIEW_HEADER, PREVIEW_THEME_HEADER } from "@/lib/preview";

/**
 * What a request renders: the composed design (design + per-section variants + type pair, docs/DESIGN-SYSTEM.md) and,
 * for a theme-gallery thumbnail, the whole flagship theme whose colours replace the published ones.
 *
 * Published: the store's published theme, composed for its plan (premium designs and variants need Max).
 * Theme Studio preview (Sec-Fetch-Dest: iframe, or the proxy-set preview header for /s/<slug>?pv=1):
 *   - ?pvt=<flagship id> → that flagship, complete (thumbnails in the theme gallery);
 *   - else the editor's unsaved composition in the cookie `bz_pv_<slug>` (v2 encoding or a bare design id).
 * Premium designs preview for everyone in the editor; the cookie only picks a presentation of public data.
 */
export const resolveStoreDesign = cache(async (slug: string, themePublished: unknown, plan: string | null | undefined): Promise<{ spec: DesignSpec; previewTheme: StoreTheme | null }> => {
  const h = await headers();
  if (h.get("sec-fetch-dest") === "iframe" || h.get(PREVIEW_HEADER) === "1") {
    const pvt = h.get(PREVIEW_THEME_HEADER);
    if (isFlagshipId(pvt)) {
      const theme = FLAGSHIPS[pvt].theme;
      return { spec: composeDesign(theme), previewTheme: theme };
    }
    const pv = decodeComposition((await cookies()).get(`bz_pv_${slug}`)?.value);
    if (pv) return { spec: pv, previewTheme: null };
  }
  return { spec: composeDesign(parseTheme(themePublished), hasFeature(normalizePlan(plan), "templatesPremium")), previewTheme: null };
});

export async function resolveDesign(slug: string, themePublished: unknown, plan: string | null | undefined): Promise<DesignSpec> {
  return (await resolveStoreDesign(slug, themePublished, plan)).spec;
}
