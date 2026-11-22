import { createHmac } from "node:crypto"

/**
 * Deterministic keyed hash so encrypted fields (tax IDs, bank account numbers)
 * can be looked up by exact match without storing plaintext.
 *
 * Uses a key separate from the encryption keyring. Scope by tenant so the same
 * value in two tenants produces different indexes.
 */
export function blindIndex(
  value: string,
  key: string,
  scope: string,
  normalize: (v: string) => string = (v) => v.trim().toLowerCase()
): string {
  const k = Buffer.from(key, "base64")
  if (k.length < 32)
    throw new Error("Blind index key must be at least 32 bytes")
  return createHmac("sha256", k)
    .update(scope)
    .update("\0")
    .update(normalize(value))
    .digest("base64url")
}
