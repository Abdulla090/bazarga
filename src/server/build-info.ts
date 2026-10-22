/**
 * Which build is running. Vercel injects VERCEL_GIT_COMMIT_SHA / VERCEL_ENV at build and runtime; a Docker/VPS
 * build passes GIT_SHA (or APP_VERSION). Never throws, never reads secrets.
 */
export type BuildInfo = { sha: string; shortSha: string; env: string; version: string };

const SHA_RE = /^[0-9a-f]{7,40}$/i;

export function buildInfo(e: Record<string, string | undefined> = process.env): BuildInfo {
  const raw = (e.VERCEL_GIT_COMMIT_SHA || e.GIT_SHA || e.SOURCE_VERSION || "").trim();
  const sha = SHA_RE.test(raw) ? raw.toLowerCase() : "unknown";
  return {
    sha,
    shortSha: sha === "unknown" ? sha : sha.slice(0, 7),
    env: e.VERCEL_ENV || e.NODE_ENV || "development",
    version: e.APP_VERSION || (sha === "unknown" ? "dev" : `1.0.0+${sha.slice(0, 7)}`),
  };
}
