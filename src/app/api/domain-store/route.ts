import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { storeSlugForDomain } from "@/server/services/custom-domain";
import { normalizeDomain } from "@/lib/custom-domain";

/**
 * Which store a verified custom domain serves (SF7). Used only by src/proxy.ts, which stays DB-free (edge-safe) and
 * caches the answer. Public data: a verified domain already shows that store to anyone who opens it.
 */
export async function GET(req: Request) {
  const host = normalizeDomain(new URL(req.url).searchParams.get("host") ?? "");
  const slug = host ? await storeSlugForDomain(db(), host).catch(() => null) : null;
  return NextResponse.json({ slug }, { headers: { "Cache-Control": "no-store" } });
}
