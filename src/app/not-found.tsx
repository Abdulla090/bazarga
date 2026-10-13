import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";

export default async function NotFound() {
  const t = await getTranslations("errors");
  const tc = await getTranslations("common");
  return (
    <main className="container-page flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <Logo />
      <p className="num text-6xl font-extrabold text-gold">404</p>
      <p className="text-lg">{t("NOT_FOUND")}</p>
      <Link href="/" className="btn-gold min-h-11 px-6">{tc("back")}</Link>
      <a href="mailto:founder@kurdistanai.app" className="text-sm underline" dir="ltr">founder@kurdistanai.app</a>
    </main>
  );
}
