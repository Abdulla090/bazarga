import type { Metadata } from "next";
import { IntlProvider } from "@/components/IntlProvider";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Onboarding renders the seller StoreForm (a client component using next-intl): it needs client messages. An admin view-as session shows its banner here too. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <IntlProvider>
      <ImpersonationBanner />
      {children}
    </IntlProvider>
  );
}
