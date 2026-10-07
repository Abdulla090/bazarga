import { IntlProvider } from "@/components/IntlProvider";

/** Onboarding renders the seller StoreForm (a client component using next-intl): it needs client messages. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <IntlProvider>{children}</IntlProvider>;
}
