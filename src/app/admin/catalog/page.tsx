import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/admin";

export const metadata = { title: "Admin · Moderation", robots: { index: false } };

/** Old "Moderation" address: products and orders now have their own sections. */
export default async function AdminCatalog({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { tab, ...rest } = sp;
  const qs = new URLSearchParams(Object.entries(rest).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(`/admin/${tab === "orders" ? "orders" : "products"}${qs ? `?${qs}` : ""}`);
}
