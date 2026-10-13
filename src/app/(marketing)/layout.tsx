import { IntlProvider } from "@/components/IntlProvider";
import "./marketing.css";

/** Landing page: the waitlist form is a next-intl client component, so this area gets client messages. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <IntlProvider>{children}</IntlProvider>;
}
