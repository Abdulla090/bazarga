import { NextResponse } from "next/server";
import { getProductDetail, getStorefrontStore } from "@/server/cache/storefront";
import { z } from "zod";
import { slugExistsSchema } from "@/lib/not-found";

/**
 * Does a public storefront exist for this slug? Used only by src/proxy.ts to answer unknown store links with a real
 * 404 status. Answers what the storefront itself shows publicly (exists or not), nothing else. Reads the same cached
 * loader as the storefront layout, so a hit costs no DB query.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = slugExistsSchema.safeParse((await params).slug);
  const store = parsed.success ? await getStorefrontStore(parsed.data) : null;
  let exists = Boolean(store);
  // Optional ?p=<product uuid>: a missing product is a 404 too.
  const pid = new URL(req.url).searchParams.get("p");
  if (store && pid) exists = z.uuid().safeParse(pid).success && Boolean(await getProductDetail(store.id, pid));
  return NextResponse.json({ exists }, { headers: { "Cache-Control": "no-store" } });
}
