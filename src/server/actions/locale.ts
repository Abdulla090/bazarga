"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

/**
 * Form version for the language dropdown before the page has hydrated (slow phone networks): a plain POST of
 * `locale`, after which Next re-renders the current page with the new cookie. Once hydrated the dropdown handles the
 * pick on the client and never submits this form.
 */
export async function setLocaleFormAction(formData: FormData) {
  await setLocaleAction(String(formData.get("locale") ?? ""));
}
