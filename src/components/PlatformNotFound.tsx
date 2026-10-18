import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { ErrorState, SUPPORT_EMAIL } from "@/components/ErrorState";

/** Platform-level 404 (marketing pages, unknown URLs, unknown store links): logo bar + error state. */
export async function PlatformNotFound({ kind = "page" }: { kind?: "page" | "store" }) {
  const t = await getTranslations("notFound");
  const store = kind === "store";
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line">
        <div className="container-page flex h-16 items-center">
          <Link href="/" aria-label="Reelcart" className="inline-flex min-h-11 items-center"><Logo /></Link>
        </div>
      </header>
      <main className="flex flex-1 items-center">
        <ErrorState
          testId={store ? "store-missing" : "platform-not-found"}
          eyebrow={t("eyebrow")}
          title={store ? t("storeTitle") : t("title")}
          body={store ? t("storeBody") : t("body")}
          actions={[
            { href: "/", label: t("home"), primary: !store },
            { href: "/signup", label: t("start"), primary: store },
          ]}
          help={{ href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL, text: t("help") }}
        />
      </main>
    </div>
  );
}
