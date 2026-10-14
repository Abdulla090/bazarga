import { NextResponse } from "next/server";
import { getStorefrontStore } from "@/server/cache/storefront";
import { slugExistsSchema } from "@/lib/not-found";

/**
 * Does a public storefront exist for this slug? Used only by src/proxy.ts to answer unknown store links with a real
 * 404 status. Answers what the storefront itself shows publicly (exists or not), nothing else. Reads the same cached
 * loader as the storefront layout, so a hit costs no DB query.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = slugExistsSchema.safeParse((await params).slug);
  const exists = parsed.success ? Boolean(await getStorefrontStore(parsed.data)) : false;
  return NextResponse.json({ exists }, { headers: { "Cache-Control": "no-store" } });
}
