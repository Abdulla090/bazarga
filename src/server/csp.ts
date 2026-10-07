/**
 * Content-Security-Policy builder (pure — imported by the proxy and by tests).
 *
 * Scripts: per-request nonce + 'strict-dynamic'. Next.js reads the nonce from the request's CSP header during
 * dynamic rendering and stamps it on its framework/bootstrap/inline scripts, so no 'unsafe-inline' is needed.
 * Styles: 'unsafe-inline' is kept on purpose — React `style={…}` attributes and Next's injected <style> tags
 * need it, and a nonce in style-src would disable 'unsafe-inline' for attributes. Style injection is far less
 * dangerous than script injection; scripts are the XSS boundary that matters.
 */
export const NONCE_HEADER = "x-nonce";

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function buildCsp(opts: { nonce: string; isDev: boolean; upgradeInsecureRequests?: boolean }): string {
  const directives = [
    "default-src 'self'",
    // 'self' is a fallback for browsers without 'strict-dynamic' (CSP2); CSP3 browsers ignore it.
    `script-src 'self' 'nonce-${opts.nonce}' 'strict-dynamic'${opts.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // https: — product images on R2/S3 public URLs; data:/blob: — upload previews.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // https: — online payment providers (FIB / ZainCash) redirect flows.
    "form-action 'self' https:",
    "object-src 'none'",
  ];
  if (opts.upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
