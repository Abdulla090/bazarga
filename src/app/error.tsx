"use client";
import { useTranslations } from "next-intl";
import { Icon, RotateCcw } from "@/components/ui/icons";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <main className="container-page flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-semibold">{t("generic")}</p>
      <button className="btn-gold" onClick={reset}><Icon as={RotateCcw} label={t("retry")} /></button>
    </main>
  );
}
