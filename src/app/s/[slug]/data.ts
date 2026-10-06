import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { getStoreBySlug } from "@/server/services/stores";

export const loadStore = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) notFound();
  const store = await getStoreBySlug(db(), slug);
  if (!store) notFound();
  return store;
});
