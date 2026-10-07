"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LOCALE_LABEL, type Locale } from "@/lib/i18n";
import { Icon, Plus, Trash2 } from "@/components/ui/icons";

export type SpecRow = { label: Partial<Record<Locale, string>>; value: Partial<Record<Locale, string>> };
const LANGS: Locale[] = ["ku", "ar", "en", "kmr"];
const MAX = 20;

/**
 * Add/remove rows of the product's details table. Every language's inputs stay in the DOM (hidden unless it is the
 * active tab) so switching tabs never loses typing; rows post as `specs.<n>.label.<locale>` / `specs.<n>.value.<locale>`.
 */
export function SpecsEditor({ initial, lang, error }: { initial: SpecRow[]; lang: Locale; error?: string }) {
  const t = useTranslations("products");
  const te = useTranslations("errors");
  const [rows, setRows] = useState(() => initial.map((r, i) => ({ key: i, ...r })));
  const [next, setNext] = useState(initial.length);
  const dir = lang === "en" || lang === "kmr" ? "ltr" : "rtl";

  return (
    <fieldset className="grid gap-3" data-testid="specs-editor">
      <legend className="font-bold">{t("specs")} · {LOCALE_LABEL[lang]}</legend>
      <p className="hint -mt-1">{t("specsHint")}</p>
      {rows.length > 0 && (
        <ul className="grid gap-2">
          {rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              {LANGS.map((l) => (
                <div key={`l-${l}`} hidden={l !== lang} dir={dir}>
                  <label className="label text-xs" htmlFor={`spec-${r.key}-label-${l}`}>{t("specLabel")}</label>
                  <input id={`spec-${r.key}-label-${l}`} name={`specs.${i}.label.${l}`} defaultValue={r.label[l] ?? ""} maxLength={120} className="input" />
                </div>
              ))}
              {LANGS.map((l) => (
                <div key={`v-${l}`} hidden={l !== lang} dir={dir}>
                  <label className="label text-xs" htmlFor={`spec-${r.key}-value-${l}`}>{t("specValue")}</label>
                  <input id={`spec-${r.key}-value-${l}`} name={`specs.${i}.value.${l}`} defaultValue={r.value[l] ?? ""} maxLength={120} className="input" />
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost btn-sm min-h-11 px-3"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                <Icon as={Trash2} label={t("removeSpec")} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="field-error">{te.has(error as "generic") ? te(error as "generic") : t("specsInvalid")}</p>}
      {rows.length < MAX && (
        <button
          type="button"
          className="btn-ghost btn-sm w-fit"
          onClick={() => {
            setRows((rs) => [...rs, { key: next, label: {}, value: {} }]);
            setNext((n) => n + 1);
          }}
        >
          <Icon as={Plus} /> {t("addSpec")}
        </button>
      )}
    </fieldset>
  );
}
