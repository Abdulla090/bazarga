import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex items-center justify-between py-4">
        <Link href="/"><Logo /></Link>
        <LocaleSwitcher locales={["ku", "ar", "en"]} />
      </header>
      <main className="container-page flex flex-1 items-start justify-center py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
