import { z } from "zod";

// No `export const dynamic`: route segment config is not allowed with cacheComponents (it broke `next build` in CI). Prerendered at build; Expires is a year ahead.

const emailSchema = z.string().email();

export function GET() {
  const parsed = emailSchema.safeParse(process.env.SECURITY_CONTACT_EMAIL);
  const contact = parsed.success ? parsed.data : "security@bazarga.app";
  const expires = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 31)).toISOString();
  const body = [
    `Contact: mailto:${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, ku, ar",
    "Policy: https://bazarga.vercel.app/security",
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
