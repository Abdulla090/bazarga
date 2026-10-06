import { createHash, randomBytes } from "node:crypto";

/** 256-bit URL-safe random token. */
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
