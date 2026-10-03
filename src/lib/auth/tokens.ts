import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Extend the DB expiry at most once per this interval (sliding expiry without a write per request). */
export const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;

/** 256-bit random token for the cookie. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash is stored, so a DB leak does not expose usable session tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** One-time temporary password like `k7mq-x2pa-9fdr` (no look-alike characters). */
export function newTempPassword(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += "-";
    out += TEMP_ALPHABET[bytes[i]! % TEMP_ALPHABET.length];
  }
  return out;
}
