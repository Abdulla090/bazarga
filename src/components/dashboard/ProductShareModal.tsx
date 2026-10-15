"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { productShareKitAction, type ProductShareKit } from "@/server/actions/share";
import { markLinkSharedAction } from "@/server/actions/setup";
import { drawShareImage } from "@/lib/share-canvas";
import { formatIQD } from "@/lib/money";
import {
  buildCaption,
  displayLink as displayUrl,
  CAPTION_LOCALES,
  SHARE_FORMATS,
  SHARE_PLATFORMS,
  SOURCE_LABEL,
  shareImageName,
  withSource,
  type CaptionLocale,
  type ShareFormat,
  type SharePlatform,
} from "@/lib/social";
import { Check, Copy, Download, Icon, Share2, X } from "@/components/ui/icons";

export type ProductShareProps = {
  productId: string;
  slug: string;
  storeName: string;
  /** Localised product names ({ ku, ar, en, kmr } as stored). */
  names: Record<string, string | undefined>;
  price: number;
  /** Default caption / image language (the dashboard language when it has captions, else the store's). */
  defaultLocale: CaptionLocale;
  onClose: () => void;
};

const noop = () => () => {};
const FORMATS: ShareFormat[] = ["story", "square"];
const LANG_LABEL: Record<CaptionLocale, string> = { ku: "کوردی", ar: "العربية", en: "English" };

function pickName(names: ProductShareProps["names"], l: CaptionLocale): string {
  return names[l] || names.ku || names.en || names.ar || Object.values(names).find(Boolean) || "";
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Share kit for one product: 9:16 + 1:1 images drawn on canvas (download / native share with files), a caption in
 * ku / ar / en with hashtags, and a copy-able link per platform carrying `?src=<platform>` so analytics can tell which
 * platform sold (S4). Native <dialog>: focus trap, Esc and inert page for free.
 */
export function ProductShareModal({ productId, slug, storeName, names, price, defaultLocale, onClose }: ProductShareProps) {
  const t = useTranslations("productShare");
  const dialog = useRef<HTMLDialogElement>(null);
  const canvases = useRef<Record<ShareFormat, HTMLCanvasElement | null>>({ story: null, square: null });
  const [kit, setKit] = useState<ProductShareKit | null>(null);
  const [failed, setFailed] = useState(false);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [lang, setLang] = useState<CaptionLocale>(defaultLocale);
  const [platform, setPlatform] = useState<SharePlatform>("tiktok");
  const [copied, setCopied] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(0);
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    let alive = true;
    productShareKitAction(productId)
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) return setFailed(true);
        setKit(r);
        if (r.image) {
          const img = await loadImage(r.image);
          if (alive) setPhoto(img);
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [productId]);

  const name = pickName(names, lang);
  const priceLabel = formatIQD(price, lang);
  const link = kit ? withSource(kit.url, platform) : "";
  const caption = useMemo(() => (kit ? buildCaption(lang, { name, price: priceLabel, store: storeName, link }) : ""), [kit, lang, name, priceLabel, storeName, link]);

  // (Re)draw both images whenever the data, photo or language changes; fonts first so Sorani glyphs are real.
  useEffect(() => {
    if (!kit) return;
    let alive = true;
    (async () => {
      const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
      try {
        await Promise.all([document.fonts.load(`800 64px ${font}`, name + storeName), document.fonts.load(`500 32px ${font}`, "سکان Scan")]);
        await document.fonts.ready;
      } catch {}
      if (!alive) return;
      for (const f of FORMATS) {
        const c = canvases.current[f];
        const ctx = c?.getContext("2d");
        if (!c || !ctx) continue;
        drawShareImage(ctx, { format: f, locale: lang, name, price, store: storeName, displayUrl: displayUrl(kit.url).replace(/\/p\/[^/]+$/, ""), qr: kit.qr, photo, font });
      }
      setDrawn((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
  }, [kit, photo, lang, name, price, storeName]);

  const record = () => void markLinkSharedAction().catch(() => {});
  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(key);
      record();
    } catch {
      /* clipboard blocked: the text is visible to select by hand */
    }
  }
  function blobOf(f: ShareFormat): Promise<Blob | null> {
    return new Promise((resolve) => {
      const c = canvases.current[f];
      if (!c) return resolve(null);
      try {
        c.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null); // tainted canvas (should not happen: photos are same-origin or inlined)
      }
    });
  }
  async function download(f: ShareFormat) {
    const b = await blobOf(f);
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = shareImageName(slug, productId, f);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    record();
  }
  async function nativeShare() {
    const b = await blobOf("story");
    const file = b ? new File([b], shareImageName(slug, productId, "story"), { type: "image/png" }) : null;
    const withFile = file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    try {
      await navigator.share(withFile ? { files: [file], text: caption, title: name } : { title: name, text: caption, url: link });
      record();
    } catch {
      /* cancelled */
    }
  }
  function close() {
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && close()}
      aria-labelledby="ps-title"
      className="ps-dialog m-auto w-[min(100vw-1rem,60rem)] max-w-none overflow-hidden rounded-[1.25rem] bg-paper p-0 text-ink shadow-[var(--shadow-e3)] backdrop:bg-ink/50 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none"
      data-testid="share-modal"
    >
      <div className="flex max-h-[min(92dvh,52rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="ps-title" className="truncate text-lg font-bold">{t("title")}</h2>
            <p className="truncate text-sm text-ink-70">{name}</p>
          </div>
          <button type="button" onClick={close} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5" autoFocus>
            <Icon as={X} label={t("close")} />
          </button>
        </div>

        <div className="grid min-h-0 gap-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {failed ? (
            <p className="text-sm text-danger lg:col-span-2" role="alert">{t("failed")}</p>
          ) : (
            <>
              <section className="grid content-start gap-3" aria-labelledby="ps-img">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="ps-img" className="font-bold">{t("images")}</h3>
                  <div className="ps-seg" role="radiogroup" aria-label={t("language")}>
                    {CAPTION_LOCALES.map((l) => (
                      <button key={l} type="button" role="radio" aria-checked={lang === l} className="ps-seg-btn" onClick={() => setLang(l)} data-testid={`share-lang-${l}`}>
                        {LANG_LABEL[l]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,9fr)_minmax(0,11fr)] items-start gap-3">
                  {FORMATS.map((f) => (
                    <figure key={f} className="grid min-w-0 gap-2">
                      <div className="relative overflow-hidden rounded-xl border border-line bg-white" style={{ aspectRatio: `${SHARE_FORMATS[f].w} / ${SHARE_FORMATS[f].h}` }}>
                        <canvas
                          ref={(el) => {
                            canvases.current[f] = el;
                          }}
                          width={SHARE_FORMATS[f].w}
                          height={SHARE_FORMATS[f].h}
                          className="block h-full w-full"
                          role="img"
                          aria-label={t(f === "story" ? "storyAlt" : "squareAlt", { name })}
                          data-testid={`share-canvas-${f}`}
                          data-drawn={drawn > 0 ? "1" : "0"}
                        />
                        {!kit && <div className="absolute inset-0 animate-pulse bg-ink/5 motion-reduce:animate-none" aria-hidden="true" />}
                      </div>
                      <figcaption className="grid gap-1.5">
                        <span className="text-xs text-ink-50">{t(f === "story" ? "storyLabel" : "squareLabel")} · <span className="num" dir="ltr">{SHARE_FORMATS[f].w}×{SHARE_FORMATS[f].h}</span></span>
                        <button type="button" className="btn-ink btn-sm w-full" disabled={!drawn} onClick={() => download(f)} data-testid={`share-download-${f}`}>
                          <Icon as={Download} /> {t("download")}
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                {canShare && (
                  <button type="button" className="btn-ghost btn-sm w-full" disabled={!drawn} onClick={nativeShare} data-testid="share-native">
                    <Icon as={Share2} /> {t("shareNative")}
                  </button>
                )}
              </section>

              <section className="grid content-start gap-4" aria-labelledby="ps-links">
                <div className="grid gap-2">
                  <h3 id="ps-links" className="font-bold">{t("links")}</h3>
                  <p className="text-sm text-ink-70">{t("linksHint")}</p>
                  <ul className="grid gap-2" data-testid="share-links">
                    {SHARE_PLATFORMS.map((p) => {
                      const url = kit ? withSource(kit.url, p) : "";
                      return (
                        <li key={p} className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-white py-1.5 ps-3 pe-1.5">
                          <span className="w-[5.5rem] shrink-0 text-sm font-semibold">{SOURCE_LABEL[p]}</span>
                          <code className="num min-w-0 flex-1 truncate text-xs text-ink-50" dir="ltr">{url ? displayUrl(url) : "…"}</code>
                          <button
                            type="button"
                            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-ink/5 px-3 text-sm font-semibold hover:bg-ink/10"
                            disabled={!kit}
                            onClick={() => copy(url, `link-${p}`)}
                            data-testid={`share-copy-${p}`}
                            data-url={url}
                          >
                            <Icon as={copied === `link-${p}` ? Check : Copy} />
                            {copied === `link-${p}` ? t("copied") : t("copyLink")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold">{t("caption")}</h3>
                    <label className="flex items-center gap-2 text-sm text-ink-70">
                      {t("captionFor")}
                      <select className="min-h-10 rounded-lg border border-line bg-white px-2 text-sm text-ink" value={platform} onChange={(e) => setPlatform(e.target.value as SharePlatform)} data-testid="share-caption-platform">
                        {SHARE_PLATFORMS.map((p) => (
                          <option key={p} value={p}>{SOURCE_LABEL[p]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <textarea
                    readOnly
                    value={caption}
                    rows={8}
                    dir={lang === "en" ? "ltr" : "rtl"}
                    lang={lang === "ku" ? "ckb" : lang}
                    aria-label={t("caption")}
                    className="w-full resize-none rounded-xl border border-line bg-white p-3 text-sm leading-relaxed"
                    data-testid="share-caption"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-ink btn-sm" disabled={!kit} onClick={() => copy(caption, "caption")} data-testid="share-copy-caption">
                      <Icon as={copied === "caption" ? Check : Copy} /> {copied === "caption" ? t("copied") : t("copyCaption")}
                    </button>
                    <a
                      className="btn-ghost btn-sm"
                      href={kit ? `https://wa.me/?text=${encodeURIComponent(buildCaption(lang, { name, price: priceLabel, store: storeName, link: withSource(kit.url, "whatsapp") }))}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={record}
                      data-testid="share-wa"
                    >
                      {t("sendWhatsapp")}
                    </a>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
