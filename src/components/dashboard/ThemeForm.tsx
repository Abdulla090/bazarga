"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveThemeAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";
import { Check, Icon } from "@/components/ui/icons";
import { PRESET_TOKENS, THEME_PRESETS, HEX_COLOR_RE, resolveTheme, type ThemePreset } from "@/lib/theme";
import { LOCALE_LABEL } from "@/lib/i18n";

type Values = {
  themePreset: ThemePreset;
  accentColor: string | null;
  about: Record<string, string | undefined>;
  returnPolicy: Record<string, string | undefined>;
};

const LANGS = ["ku", "ar", "en"] as const;

/** Pick one of the 3 storefront presets, optionally override the accent, and write about / return policy. */
export function ThemeForm({ initial }: { initial: Values }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(saveThemeAction, {});
  const [preset, setPreset] = useState<ThemePreset>(initial.themePreset);
  const [accent, setAccent] = useState(initial.accentColor ?? "");
  const preview = resolveTheme(preset, HEX_COLOR_RE.test(accent) ? accent : null);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="card grid gap-4">
      <div>
        <h2 className="text-lg font-bold">{t("theme")}</h2>
        <p className="hint">{t("themeHint")}</p>
      </div>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      {state.ok && <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{tc("saved")}</p>}

      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">{t("theme")}</legend>
        {THEME_PRESETS.map((p) => {
          const tok = PRESET_TOKENS[p];
          const on = preset === p;
          return (
            <label
              key={p}
              className={`relative cursor-pointer overflow-hidden rounded-xl border-2 ${on ? "border-ink" : "border-line"}`}
            >
              <input type="radio" name="themePreset" value={p} checked={on} onChange={() => setPreset(p)} className="sr-only" />
              <span className="block h-10" style={{ background: tok.hero }} />
              <span className="flex items-center gap-2 p-2 text-sm font-semibold" style={{ background: tok.bg, color: tok.fg }}>
                <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: tok.accent }} />
                {t(`theme_${p}`)}
              </span>
              {on && (
                <span className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-paper text-ink">
                  <Icon as={Check} />
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      <div>
        <label className="label" htmlFor="f-accent">{t("accentColor")}</label>
        <div className="flex items-center gap-2" dir="ltr">
          <input
            type="color"
            aria-label={t("accentColor")}
            value={HEX_COLOR_RE.test(accent) ? accent : preview.accent}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white"
          />
          <input
            id="f-accent"
            name="accentColor"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            placeholder={PRESET_TOKENS[preset].accent}
            className="input num max-w-40"
            maxLength={7}
            aria-invalid={!!fe.accentColor || undefined}
          />
          {accent && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAccent("")}>
              {tc("reset")}
            </button>
          )}
          <span className="btn btn-sm pointer-events-none" style={{ background: preview.accent, color: preview.onAccent }} aria-hidden>
            Aa
          </span>
        </div>
        {fe.accentColor ? <p className="field-error">{te("invalid_color")}</p> : <p className="hint">{t("accentHint")}</p>}
      </div>

      {(["about", "returnPolicy"] as const).map((field) => (
        <fieldset key={field} className="grid gap-2">
          <legend className="label">{t(field)}</legend>
          {LANGS.map((l) => (
            <textarea
              key={l}
              name={`${field}.${l}`}
              rows={2}
              maxLength={2000}
              className="input"
              dir={l === "en" ? "ltr" : "rtl"}
              placeholder={LOCALE_LABEL[l]}
              defaultValue={initial[field][l] ?? ""}
            />
          ))}
        </fieldset>
      ))}

      <button className="btn-gold" disabled={pending}>{t("saveTheme")}</button>
    </form>
  );
}
