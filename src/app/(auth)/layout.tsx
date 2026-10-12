import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { IntlProvider } from "@/components/IntlProvider";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/server/locale";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  const tp = await getTranslations("pricing");
  return (
    <IntlProvider>
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex items-center justify-between gap-2 border-b border-[#E7E5E4] py-3">
        <Link href="/" className="inline-flex min-h-11 items-center"><Logo /></Link>
        <span className="ms-auto hidden text-xs font-semibold text-[#2563EB] sm:inline">{tp("onb")}</span>
        <LocaleSwitcher current={locale} locales={["ku", "kmr", "ar", "en"]} compact />
      </header>
      <main className="container-page flex flex-1 items-start justify-center py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
    </IntlProvider>
  );
}
