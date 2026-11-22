import "server-only"

import {
  FieldEncryptor,
  LocalKeyProvider,
  blindIndex as hmacIndex,
} from "@workspace/crypto"

import { env } from "@/lib/env"

function createProvider() {
  switch (env.ENCRYPTION_PROVIDER) {
    case "local":
      return LocalKeyProvider.fromEnv(process.env)
    case "kms":
      // Implement KeyProvider against your cloud KMS (AWS KMS Encrypt/Decrypt with
      // EncryptionContext, GCP KMS, Azure Key Vault, or Vault Transit) before go-live.
      throw new Error("KMS key provider not configured yet")
  }
}

/** Encrypt sensitive fields (bank details, tax IDs, PHI) before they hit the database. */
export const encryptor = new FieldEncryptor(createProvider())

export function blindIndex(value: string, tenantId: string) {
  return hmacIndex(value, env.BLIND_INDEX_KEY, tenantId)
}
