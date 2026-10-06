"use client";
import { useTranslations } from "next-intl";
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string; error?: string; ltr?: boolean };

export function Field({ label, name, hint, error, ltr, className = "", ...rest }: Props) {
  const te = useTranslations("errors");
  const id = rest.id ?? `f-${name}`;
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        className={`input ${ltr ? "num" : ""}`}
        dir={ltr ? "ltr" : undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error">{te(error as "generic")}</p>}
    </div>
  );
}

export function FormError({ error }: { error?: string }) {
  const te = useTranslations("errors");
  if (!error) return null;
  return <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{te(error as "generic")}</p>;
}
