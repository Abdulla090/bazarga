import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { IntlProvider } from "@/components/IntlProvider";
import { currentLocale } from "@/server/locale";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  return (
    <IntlProvider>
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex items-center justify-between py-4">
        <Link href="/" className="inline-flex min-h-11 items-center"><Logo /></Link>
        <LocaleSwitcher current={locale} locales={["ku", "ar", "en"]} />
      </header>
      <main className="container-page flex flex-1 items-start justify-center py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
    </IntlProvider>
  );
}
