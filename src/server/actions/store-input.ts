import "server-only";
import { storeSchema } from "@/lib/validation";
import { formObject, localizedFromForm } from "./util";

/** Store fields from the onboarding / settings / new-store form. */
export function storeInputFromForm(fd: FormData) {
  const o = formObject(fd);
  return storeSchema.parse({
    name: o.name,
    slug: o.slug,
    defaultLocale: o.defaultLocale,
    phone: o.phone || undefined,
    whatsapp: o.whatsapp || undefined,
    instagram: o.instagram || undefined,
    city: o.city || undefined,
    tagline: localizedFromForm(fd, "tagline"),
  });
}
