import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { designSpec, isDesignId, type DesignSpec } from "@/lib/theme-studio/designs";
import { parseTheme } from "@/lib/theme-studio/resolve";
import { hasFeature, normalizePlan } from "@/lib/plans";

/**
 * The design (layout family) this request renders: the published theme's, except inside the Theme Studio preview
 * iframe, where the editor's unsaved choice (cookie `bz_pv_<slug>`) wins so a design switch is visible before
 * publishing. The cookie only picks a presentation of public data and is honoured for iframe loads only.
 * Premium designs (Max) preview for everyone in the editor; a published premium design on a store below Max renders classic.
 */
export const resolveDesign = cache(async (slug: string, themePublished: unknown, plan: string | null | undefined): Promise<DesignSpec> => {
  const published = parseTheme(themePublished)?.design;
  const dest = (await headers()).get("sec-fetch-dest");
  if (dest === "iframe") {
    const pv = (await cookies()).get(`bz_pv_${slug}`)?.value;
    if (isDesignId(pv)) return designSpec(pv);
  }
  return designSpec(published, hasFeature(normalizePlan(plan), "templatesPremium"));
});
