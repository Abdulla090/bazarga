import type { Metadata } from "next";
import { LegalDocument, legalMetadata } from "@/components/LegalDocument";
import { currentLocale } from "@/server/locale";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("privacy", await currentLocale());
}

export default async function Page() {
  return <LegalDocument doc="privacy" locale={await currentLocale()} />;
}
