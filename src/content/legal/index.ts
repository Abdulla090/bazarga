import type { Locale } from "@/lib/i18n";
import { PRIVACY } from "./privacy";
import { REFUNDS } from "./refunds";
import { TERMS } from "./terms";
import type { LegalDoc } from "./types";

export const LEGAL_SLUGS = ["terms", "privacy", "refunds"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** Bump when any legal text changes in a way users should know about. */
export const LEGAL_UPDATED = "2026-10-13";

const DOCS = { terms: TERMS, privacy: PRIVACY, refunds: REFUNDS } as const;

export function legalDoc(slug: LegalSlug, locale: Locale): LegalDoc {
  return DOCS[slug][locale];
}
