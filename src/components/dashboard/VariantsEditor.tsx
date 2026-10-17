"use client";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { LOCALE_LABEL, pickText, type Locale } from "@/lib/i18n";
import { Icon, Plus, Trash2, X } from "@/components/ui/icons";
import {
  MAX_OPTIONS,
  MAX_VALUES,
  MAX_VARIANTS,
  OPTION_PRESETS,
  combinations,
  newKey,
  rowTitle,
  splitValues,
  syncRows,
  type EditorOption,
  type EditorRow,
  type EditorState,
  type LText,
} from "@/lib/variant-editor";

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Math.floor(Number(t));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Seller editor for option groups (Size, Colour…) and the per-combination rows. Every combination is generated
 * automatically; rows the seller already filled survive adding or removing values. Names follow the language tab
 * like the rest of the product form. The whole editor posts as one JSON hidden input named `variants`.
 */
export function VariantsEditor({
  initial,
  lang,
  error,
  onHasVariants,
}: {
  initial: EditorState;
  lang: Locale;
  error?: string;
  onHasVariants?: (has: boolean) => void;
}) {
  const t = useTranslations("products");
  const te = useTranslations("errors");
  const uid = useId();
  const [state, setState] = useState<EditorState>(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [limitHit, setLimitHit] = useState(false);
  const [bulk, setBulk] = useState({ price: "", stock: "" });
  const dir = lang === "en" || lang === "kmr" ? "ltr" : "rtl";
  const pick = (txt: LText) => pickText(txt, lang);
  const rows = state.variants;
  const has = rows.length > 0;
  useEffect(() => onHasVariants?.(has), [has, onHasVariants]);

  const setOptions = (fn: (o: EditorOption[]) => EditorOption[]) => {
    setState((s) => {
      const options = fn(s.options);
      if (combinations(options).length > MAX_VARIANTS) {
        setLimitHit(true);
        return s;
      }
      setLimitHit(false);
      return { options, variants: syncRows(options, s.variants) };
    });
  };
  const setRow = (i: number, patch: Partial<EditorRow>) =>
    setState((s) => ({ ...s, variants: s.variants.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const addOption = (preset?: keyof typeof OPTION_PRESETS) =>
    setOptions((o) => [
      ...o,
      {
        key: newKey("o"),
        name: preset ? { ...OPTION_PRESETS[preset].name } : {},
        swatches: preset ? OPTION_PRESETS[preset].swatches : false,
        values: [],
      },
    ]);

  const NAMED: Record<string, string> = {
    black: "#111827", white: "#F9FAFB", red: "#DC2626", blue: "#2563EB", green: "#16A34A", yellow: "#EAB308",
    pink: "#EC4899", purple: "#7C3AED", gray: "#6B7280", grey: "#6B7280", brown: "#92400E", beige: "#D6C3A3",
    navy: "#1E3A8A", orange: "#EA580C", gold: "#CA8A04", silver: "#9CA3AF",
    "ڕەش": "#111827", "سپی": "#F9FAFB", "سور": "#DC2626", "شین": "#2563EB", "سەوز": "#16A34A", "زەرد": "#EAB308",
    "أسود": "#111827", "أبيض": "#F9FAFB", "أحمر": "#DC2626", "أزرق": "#2563EB", "أخضر": "#16A34A", "أصفر": "#EAB308",
  };
  const swatchFor = (l: string) => NAMED[l.trim().toLowerCase()] ?? "#2563EB";

  const addValues = (opt: EditorOption) => {
    const raw = drafts[opt.key] ?? "";
    const labels = splitValues(raw, opt.values.map((v) => pick(v.label))).slice(0, MAX_VALUES - opt.values.length);
    if (!labels.length) return;
    setOptions((os) =>
      os.map((o) =>
        o.key === opt.key
          ? { ...o, values: [...o.values, ...labels.map((l) => ({ key: newKey("v"), label: { [lang]: l } as LText, swatch: o.swatches ? swatchFor(l) : null }))] }
          : o,
      ),
    );
    setDrafts((d) => ({ ...d, [opt.key]: "" }));
  };
  const onValueKey = (e: KeyboardEvent<HTMLInputElement>, opt: EditorOption) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault(); // never submit the whole product form from here
      addValues(opt);
    }
  };

  const applyBulk = () => {
    const price = numOrNull(bulk.price);
    const stock = numOrNull(bulk.stock);
    setState((s) => ({
      ...s,
      variants: s.variants.map((r) => ({ ...r, ...(bulk.price.trim() ? { price } : {}), ...(bulk.stock.trim() ? { stock } : {}) })),
    }));
    setBulk({ price: "", stock: "" });
  };

  const payload = useMemo(() => JSON.stringify(state), [state]);
  const errText = error ? (te.has(error as "generic") ? te(error as "generic") : te("VALIDATION")) : null;

  return (
    <fieldset className="grid gap-4" data-testid="variants-editor">
      <legend className="font-bold">{t("variants")} · {LOCALE_LABEL[lang]}</legend>
      <p className="hint -mt-2">{t("variantsHint")}</p>
      <input type="hidden" name="variants" value={payload} />

      {state.options.map((o, oi) => (
        <div key={o.key} className="grid gap-3 rounded-xl border border-line p-3 sm:p-4" data-testid="variant-option">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1" dir={dir}>
              <label className="label text-xs" htmlFor={`${uid}-on-${o.key}`}>{t("optionName")}</label>
              <input
                id={`${uid}-on-${o.key}`}
                className="input"
                maxLength={60}
                value={o.name[lang] ?? ""}
                placeholder={pick(o.name) || t("optionNamePh")}
                onChange={(e) => {
                  const v = e.target.value;
                  setState((s) => ({ ...s, options: s.options.map((x) => (x.key === o.key ? { ...x, name: { ...x.name, [lang]: v } } : x)) }));
                }}
              />
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm min-h-11 min-w-11 px-3"
              onClick={() => setOptions((os) => os.filter((x) => x.key !== o.key))}
              data-testid="remove-option"
            >
              <Icon as={Trash2} label={`${t("removeOption")} ${oi + 1}`} />
            </button>
          </div>

          <label className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-ink"
              checked={!!o.swatches}
              onChange={(e) => {
                const on = e.target.checked;
                setState((s) => ({
                  ...s,
                  options: s.options.map((x) =>
                    x.key === o.key ? { ...x, swatches: on, values: x.values.map((v) => ({ ...v, swatch: on ? (v.swatch ?? swatchFor(pick(v.label))) : v.swatch })) } : x,
                  ),
                }));
              }}
            />
            {t("swatches")}
          </label>

          <div className="grid gap-2">
            <span className="label text-xs" id={`${uid}-vals-${o.key}`}>{t("optionValues")}</span>
            {o.values.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-labelledby={`${uid}-vals-${o.key}`}>
                {o.values.map((v) => {
                  const shown = pick(v.label);
                  return (
                    <li key={v.key} className="flex min-h-11 items-center gap-1 rounded-full border border-line ps-1 pe-1" dir={dir}>
                      {o.swatches && (
                        <label className="relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                          <span className="sr-only">{t("swatchFor", { value: shown })}</span>
                          <span className="h-6 w-6 rounded-full border border-line" style={{ background: v.swatch ?? "#2563EB" }} aria-hidden />
                          <input
                            type="color"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            value={v.swatch ?? "#2563EB"}
                            onChange={(e) => {
                              const c = e.target.value.toUpperCase();
                              setState((s) => ({
                                ...s,
                                options: s.options.map((x) => (x.key === o.key ? { ...x, values: x.values.map((y) => (y.key === v.key ? { ...y, swatch: c } : y)) } : x)),
                              }));
                            }}
                          />
                        </label>
                      )}
                      <input
                        aria-label={`${pick(o.name) || t("optionName")}: ${shown}`}
                        className="h-11 w-[7.5rem] min-w-0 rounded-full bg-transparent px-2 text-sm font-semibold outline-offset-2 sm:w-28"
                        maxLength={60}
                        value={v.label[lang] ?? ""}
                        placeholder={shown}
                        onChange={(e) => {
                          const val = e.target.value;
                          setState((s) => ({
                            ...s,
                            options: s.options.map((x) =>
                              x.key === o.key ? { ...x, values: x.values.map((y) => (y.key === v.key ? { ...y, label: { ...y.label, [lang]: val } } : y)) } : x,
                            ),
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-line/40"
                        onClick={() => setOptions((os) => os.map((x) => (x.key === o.key ? { ...x, values: x.values.filter((y) => y.key !== v.key) } : x)))}
                      >
                        <Icon as={X} label={t("removeValue", { value: shown })} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {o.values.length < MAX_VALUES && (
              <div className="flex gap-2" dir={dir}>
                <input
                  className="input min-w-0 flex-1"
                  aria-label={`${t("optionValues")}: ${pick(o.name) || t("optionName")}`}
                  placeholder={t("valuePh")}
                  maxLength={400}
                  enterKeyHint="done"
                  value={drafts[o.key] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [o.key]: e.target.value }))}
                  onKeyDown={(e) => onValueKey(e, o)}
                  onBlur={() => (drafts[o.key] ?? "").includes(",") && addValues(o)}
                  data-testid="option-value-input"
                />
                <button type="button" className="btn-ghost min-h-11 shrink-0 px-4" onClick={() => addValues(o)} data-testid="option-value-add">
                  <Icon as={Plus} /> {t("addValue")}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {limitHit && <p className="field-error" role="alert">{t("variantsLimit", { max: MAX_VARIANTS })}</p>}

      {state.options.length < MAX_OPTIONS ? (
        <div className="flex flex-wrap gap-2">
          {!state.options.some((o) => o.name.en === OPTION_PRESETS.size.name.en) && (
            <button type="button" className="btn-ghost btn-sm min-h-11" onClick={() => addOption("size")} data-testid="add-option-size">
              <Icon as={Plus} /> {t("presetSize")}
            </button>
          )}
          {!state.options.some((o) => o.name.en === OPTION_PRESETS.colour.name.en) && (
            <button type="button" className="btn-ghost btn-sm min-h-11" onClick={() => addOption("colour")} data-testid="add-option-colour">
              <Icon as={Plus} /> {t("presetColour")}
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm min-h-11" onClick={() => addOption()} data-testid="add-option">
            <Icon as={Plus} /> {t("addOption")}
          </button>
        </div>
      ) : (
        <p className="hint">{t("maxOptions")}</p>
      )}

      {has && (
        <div className="grid gap-3" data-testid="variant-rows">
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-line/30 p-3">
            <div className="w-32">
              <label className="label text-xs" htmlFor={`${uid}-bp`}>{t("bulkPrice")}</label>
              <input id={`${uid}-bp`} className="input" dir="ltr" type="number" inputMode="numeric" min={0} step={250} value={bulk.price} onChange={(e) => setBulk((b) => ({ ...b, price: e.target.value }))} />
            </div>
            <div className="w-28">
              <label className="label text-xs" htmlFor={`${uid}-bs`}>{t("bulkStock")}</label>
              <input id={`${uid}-bs`} className="input" dir="ltr" type="number" inputMode="numeric" min={0} value={bulk.stock} onChange={(e) => setBulk((b) => ({ ...b, stock: e.target.value }))} />
            </div>
            <button type="button" className="btn-ghost min-h-11" disabled={!bulk.price.trim() && !bulk.stock.trim()} onClick={applyBulk} data-testid="variant-apply-all">
              {t("applyAll")}
            </button>
            <p className="hint ms-auto self-center" aria-live="polite">{t("variantCount", { count: rows.length })}</p>
          </div>

          <ul className="grid gap-2">
            {rows.map((r, i) => {
              const title = rowTitle(state.options, r.keys, pick);
              const id = `${uid}-r${i}`;
              return (
                <li
                  key={r.keys.join("|")}
                  className={`grid grid-cols-2 items-end gap-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_8.5rem_auto] ${r.isActive ? "" : "opacity-60"}`}
                  data-testid="variant-row"
                >
                  <p className="col-span-2 min-w-0 self-center break-words font-semibold sm:col-span-1" dir={dir}>{title}</p>
                  <div>
                    <label className="label text-xs" htmlFor={`${id}-p`}>{t("variantPrice")}</label>
                    <input
                      id={`${id}-p`}
                      className="input"
                      dir="ltr"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={250}
                      placeholder={t("variantPricePh")}
                      value={r.price ?? ""}
                      onChange={(e) => setRow(i, { price: numOrNull(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`${id}-s`}>{t("variantStock")}</label>
                    <input
                      id={`${id}-s`}
                      className="input"
                      dir="ltr"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={t("variantStockPh")}
                      value={r.stock ?? ""}
                      onChange={(e) => setRow(i, { stock: numOrNull(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`${id}-k`}>{t("variantSku")}</label>
                    <input
                      id={`${id}-k`}
                      className="input"
                      dir="ltr"
                      maxLength={64}
                      autoComplete="off"
                      value={r.sku ?? ""}
                      onChange={(e) => setRow(i, { sku: e.target.value.replace(/[^A-Za-z0-9._/-]/g, "") || null })}
                    />
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold sm:justify-center">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-ink"
                      aria-label={`${t("variantOn")}: ${title}`}
                      checked={r.isActive}
                      onChange={(e) => setRow(i, { isActive: e.target.checked })}
                    />
                    <span className="sm:sr-only" aria-hidden>{t("variantOn")}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {errText && <p className="field-error" role="alert" data-testid="variants-error">{errText}</p>}
    </fieldset>
  );
}
