"use client";
import { useEffect } from "react";

/** Progressive enhancement: submits the surrounding GET search form ~450ms after typing stops. */
export function InstantSearch({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const input = form?.querySelector<HTMLInputElement>('input[name="q"]');
    if (!form || !input) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const initial = input.value;
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (input.value.trim() !== initial.trim() && input.value.trim().length !== 1) form.requestSubmit();
      }, 450);
    };
    input.addEventListener("input", onInput);
    return () => { clearTimeout(timer); input.removeEventListener("input", onInput); };
  }, [formId]);
  return null;
}
