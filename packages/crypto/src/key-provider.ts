import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * A key-encryption-key (KEK) provider. KEKs never leave the provider; it only
 * wraps and unwraps short-lived data-encryption keys (DEKs).
 *
 * Production must use a KMS/HSM-backed provider (AWS KMS, GCP KMS, Azure Key
 * Vault, HashiCorp Vault Transit). `LocalKeyProvider` exists for development
 * and tests only.
 */
export interface KeyProvider {
  /** Stable identifier for the provider type, recorded for audit. */
  readonly kind: string
  /** ID of the KEK used for new encryptions. */
  readonly activeKeyId: string
  wrapKey(dek: Buffer, context: Record<string, string>): Promise<WrappedKey>
  unwrapKey(
    wrapped: WrappedKey,
    context: Record<string, string>
  ): Promise<Buffer>
}

export interface WrappedKey {
  keyId: string
  /** Base64url-encoded wrapped DEK. */
  ciphertext: string
}

const KEY_BYTES = 32
const IV_BYTES = 12

/**
 * Wraps DEKs with AES-256-GCM using KEKs held in process memory.
 * Supports multiple key versions so old data stays readable during rotation.
 */
export class LocalKeyProvider implements KeyProvider {
  readonly kind = "local"
  readonly activeKeyId: string
  readonly #keys: Map<string, Buffer>

  constructor(keyring: Record<string, string>, activeKeyId: string) {
    this.#keys = new Map()
    for (const [id, b64] of Object.entries(keyring)) {
      const key = Buffer.from(b64, "base64")
      if (key.length !== KEY_BYTES) {
        throw new Error(
          `KEK "${id}" must be ${KEY_BYTES} bytes (got ${key.length})`
        )
      }
      this.#keys.set(id, key)
    }
    if (!this.#keys.has(activeKeyId)) {
      throw new Error(`Active KEK "${activeKeyId}" is not in the keyring`)
    }
    this.activeKeyId = activeKeyId
  }

  /** Build from ENCRYPTION_KEYRING (JSON {id: base64Key}) and ENCRYPTION_ACTIVE_KEY_ID. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): LocalKeyProvider {
    const raw = env.ENCRYPTION_KEYRING
    const active = env.ENCRYPTION_ACTIVE_KEY_ID
    if (!raw || !active) {
      throw new Error(
        "ENCRYPTION_KEYRING and ENCRYPTION_ACTIVE_KEY_ID are required"
      )
    }
    return new LocalKeyProvider(
      JSON.parse(raw) as Record<string, string>,
      active
    )
  }

  async wrapKey(
    dek: Buffer,
    context: Record<string, string>
  ): Promise<WrappedKey> {
    const kek = this.#keys.get(this.activeKeyId)!
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv("aes-256-gcm", kek, iv)
    cipher.setAAD(contextToAad(context))
    const ct = Buffer.concat([cipher.update(dek), cipher.final()])
    return {
      keyId: this.activeKeyId,
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), ct]).toString(
        "base64url"
      ),
    }
  }

  async unwrapKey(
    wrapped: WrappedKey,
    context: Record<string, string>
  ): Promise<Buffer> {
    const kek = this.#keys.get(wrapped.keyId)
    if (!kek) throw new Error(`Unknown KEK "${wrapped.keyId}"`)
    const buf = Buffer.from(wrapped.ciphertext, "base64url")
    const decipher = createDecipheriv(
      "aes-256-gcm",
      kek,
      buf.subarray(0, IV_BYTES)
    )
    decipher.setAAD(contextToAad(context))
    decipher.setAuthTag(buf.subarray(IV_BYTES, IV_BYTES + 16))
    return Buffer.concat([
      decipher.update(buf.subarray(IV_BYTES + 16)),
      decipher.final(),
    ])
  }
}

/** Canonical, order-independent encoding of an encryption context. */
export function contextToAad(context: Record<string, string>): Buffer {
  const sorted = Object.keys(context)
    .sort()
    .map((k) => [k, context[k]])
  return Buffer.from(JSON.stringify(sorted), "utf8")
}

/** Generate a new random 256-bit key, base64-encoded, for a keyring entry. */
export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("base64")
}
