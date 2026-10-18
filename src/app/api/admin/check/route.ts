import { NextResponse, connection } from "next/server";
import { currentAdmin } from "@/server/auth/admin";

/**
 * Used by src/proxy.ts so /admin answers a real 404 status to non-admins (with Cache Components a page's status line is
 * sent before its notFound() runs). Reveals only whether the caller themself is a platform admin.
 */
export async function GET() {
  await connection();
  let admin = false;
  try {
    admin = !!(await currentAdmin());
  } catch {
    admin = false;
  }
  return NextResponse.json({ admin }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
