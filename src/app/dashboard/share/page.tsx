import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { env } from "@/server/env";
import { CopyButton } from "@/components/CopyButton";
import { RecordShareClicks } from "@/components/dashboard/RecordShareClicks";
import { Download, Icon, MessageCircle } from "@/components/ui/icons";
import { LOCALE_LABEL, LOCALES, dirOf } from "@/lib/i18n";
import { qrMatrix, qrPath, storeUrl, waShareLink } from "@/lib/share-kit";

export const metadata = { title: "Share kit" };

/**
 * Share kit: bio link, QR code and Instagram story image. Server-rendered; no client JS beyond the copy buttons
 * and the click recorder: copy / download / WhatsApp all tick the setup checklist's "share" step.
 */
export default async function ShareKitPage() {
  const { store } = await requireStore();
  const t = await getTranslations("shareKit");
  const url = storeUrl(env().APP_URL, store.slug);
  const bio = t("bioLine", { url });
  const qr = qrMatrix(url);
  const n = qr.size + 8;
  const storyLang = store.defaultLocale;

  return (
    <div className="grid max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-ink-70">{t("subtitle")}</p>
      </div>

      <section className="card grid gap-3" aria-labelledby="sk-link">
        <h2 id="sk-link" className="text-lg font-bold">{t("linkTitle")}</h2>
        <p className="text-sm text-ink-70">{t("linkHint")}</p>
        <RecordShareClicks className="flex flex-wrap items-center gap-2">
          <code className="num min-w-0 max-w-full break-all rounded-lg bg-ink/5 px-3 py-2 text-sm" dir="ltr" data-testid="share-url">{url}</code>
          <CopyButton text={url} testId="share-copy-url" />
        </RecordShareClicks>
        <p className="label mt-2">{t("bioTitle")}</p>
        <p className="whitespace-pre-line break-words rounded-lg border border-line bg-white p-3 text-sm" data-testid="share-bio">{bio}</p>
        <RecordShareClicks className="flex flex-wrap gap-2">
          <CopyButton text={bio} testId="share-copy-bio" />
          <a href={waShareLink(bio)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
            <Icon as={MessageCircle} /> {t("whatsapp")}
          </a>
        </RecordShareClicks>
      </section>

      <section className="card grid gap-3" aria-labelledby="sk-qr">
        <h2 id="sk-qr" className="text-lg font-bold">{t("qrTitle")}</h2>
        <p className="text-sm text-ink-70">{t("qrHint")}</p>
        <svg
          viewBox={`0 0 ${n} ${n}`}
          className="h-48 w-48 rounded-xl border border-line bg-white"
          shapeRendering="crispEdges"
          role="img"
          aria-label={t("qrAlt", { url })}
          data-testid="share-qr"
        >
          <path fill="#0f1b2d" d={qrPath(qr, 4)} />
        </svg>
        <RecordShareClicks className="flex flex-wrap gap-2">
          <a href="/api/share/qr?format=png&download=1" download className="btn-ink btn-sm"><Icon as={Download} /> {t("downloadPng")}</a>
          <a href="/api/share/qr?format=svg&download=1" download className="btn-ghost btn-sm"><Icon as={Download} /> {t("downloadSvg")}</a>
        </RecordShareClicks>
      </section>

      <section className="card grid gap-3" aria-labelledby="sk-story">
        <h2 id="sk-story" className="text-lg font-bold">{t("storyTitle")}</h2>
        <p className="text-sm text-ink-70">{t("storyHint")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- private, session-scoped PNG; next/image would cache it publicly */}
        <img
          src={`/api/share/story?lang=${storyLang}`}
          alt={t("storyAlt")}
          width={180}
          height={320}
          loading="lazy"
          decoding="async"
          className="h-80 w-[180px] rounded-xl border border-line bg-ink/5 object-cover"
          data-testid="share-story-preview"
        />
        <p className="label">{t("storyDownload")}</p>
        <RecordShareClicks className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <a
              key={l}
              href={`/api/share/story?lang=${l}&download=1`}
              download
              className={l === storyLang ? "btn-ink btn-sm" : "btn-ghost btn-sm"}
              lang={l === "ku" ? "ckb" : l}
              dir={dirOf(l)}
            >
              <Icon as={Download} /> {LOCALE_LABEL[l]}
            </a>
          ))}
        </RecordShareClicks>
      </section>
    </div>
  );
}
