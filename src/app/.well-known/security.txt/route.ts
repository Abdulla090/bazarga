// No route segment config: `dynamic` is incompatible with cacheComponents and broke `next build` on Vercel (Oct 23).

const contact = process.env.SECURITY_CONTACT_EMAIL || "founder@kurdistanai.app";

export function buildSecurityTxt(email: string, base: string): string {
  const expires = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)).toISOString();
  return [
    `Contact: mailto:${email}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, ar, ku",
    `Canonical: ${base}/.well-known/security.txt`,
    "",
  ].join("\n");
}

export function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://bazarga.vercel.app").replace(/\/$/, "");
  return new Response(buildSecurityTxt(contact, base), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
