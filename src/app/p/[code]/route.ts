import { db } from "@/server/db";
import { resolveShortCode } from "@/server/services/short-links";
import { shortLinkTarget } from "@/lib/short-link";

/**
 * Short product link `/p/<code>` (what the share kit and a seller's bio use). Redirects to the product page and keeps
 * the query string, so `?src=tiktok` still reaches source attribution. Unknown codes land on the platform 404 page.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const hit = await resolveShortCode(db(), code);
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!hit) return new Response(null, { status: 307, headers: { ...headers, Location: "/e404" } });
  const search = new URL(req.url).search;
  return new Response(null, { status: 307, headers: { ...headers, Location: shortLinkTarget(hit.slug, hit.productId, search) } });
}
