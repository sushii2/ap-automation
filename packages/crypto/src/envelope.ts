import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { contextToAad } from "./key-provider.ts";
import type { KeyProvider } from "./key-provider.ts";

/**
 * Field-level envelope encryption (AES-256-GCM).
 *
 * Each value gets a fresh DEK, which is wrapped by the provider's KEK. The
 * encryption context (e.g. tenant, table, column, row id) is bound as AAD to
 * both layers, so a ciphertext copied to another row/tenant fails to decrypt.
 *
 * Wire format: `enc.v1.<keyId>.<wrappedDek>.<iv>.<tag>.<ciphertext>` (base64url parts).
 */

const PREFIX = "enc";
const VERSION = "v1";
const IV_BYTES = 12;

export type EncryptionContext = Record<string, string>;

export class FieldEncryptor {
  readonly #provider: KeyProvider;

  constructor(provider: KeyProvider) {
    this.#provider = provider;
  }

  async encrypt(
    plaintext: string,
    context: EncryptionContext
  ): Promise<string> {
    assertContext(context);
    const dek = randomBytes(32);
    try {
      const wrapped = await this.#provider.wrapKey(dek, context);
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", dek, iv);
      cipher.setAAD(contextToAad(context));
      const ct = Buffer.concat([
        cipher.update(plaintext, "utf-8"),
        cipher.final(),
      ]);
      return [
        PREFIX,
        VERSION,
        b64(Buffer.from(wrapped.keyId, "utf-8")),
        wrapped.ciphertext,
        b64(iv),
        b64(cipher.getAuthTag()),
        b64(ct),
      ].join(".");
    } finally {
      dek.fill(0);
    }
  }

  async decrypt(token: string, context: EncryptionContext): Promise<string> {
    assertContext(context);
    const parts = token.split(".");
    if (parts.length !== 7 || parts[0] !== PREFIX || parts[1] !== VERSION) {
      throw new Error("Malformed ciphertext");
    }
    const [, , keyIdB64, wrappedDek, ivB64, tagB64, ctB64] = parts as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const dek = await this.#provider.unwrapKey(
      { keyId: unb64(keyIdB64).toString("utf-8"), ciphertext: wrappedDek },
      context
    );
    try {
      const decipher = createDecipheriv("aes-256-gcm", dek, unb64(ivB64));
      decipher.setAAD(contextToAad(context));
      decipher.setAuthTag(unb64(tagB64));
      return Buffer.concat([
        decipher.update(unb64(ctB64)),
        decipher.final(),
      ]).toString("utf-8");
    } finally {
      dek.fill(0);
    }
  }

  /**
  KEK id a ciphertext was wrapped with; use to find values needing re-encryption after rotation.
  */
  static keyIdOf(token: string): string {
    const keyIdB64 = token.split(".", 3)[2];
    if (!keyIdB64) {
      throw new Error("Malformed ciphertext");
    }
    return unb64(keyIdB64).toString("utf-8");
  }

  static isEncrypted(value: string): boolean {
    return value.startsWith(`${PREFIX}.${VERSION}.`);
  }
}

function assertContext(context: EncryptionContext) {
  if (Object.keys(context).length === 0) {
    throw new Error(
      "An encryption context is required (e.g. { tenantId, table, column, id })"
    );
  }
}

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");
