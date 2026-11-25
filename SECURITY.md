# Security & compliance baseline

Targets: SOC 2 Type II, ISO/IEC 27001 (Annex A), HIPAA Security Rule. The code here covers the technical encryption controls. Compliance also needs policies, evidence collection, and vendor BAAs/DPAs, which code can't provide.

## Encryption in transit

| Control | Where |
| --- | --- |
| HSTS, 2 years, subdomains, preload | `apps/web/lib/security-headers.ts` |
| HTTP → HTTPS 308 redirect behind a TLS-terminating proxy | `apps/web/proxy.ts` |
| Nonce-based CSP (`strict-dynamic`, `frame-ancestors 'none'`, `upgrade-insecure-requests`) | `apps/web/proxy.ts`, `lib/security-headers.ts` |
| Anti-clickjacking, MIME sniffing, referrer, permissions, COOP/CORP headers | `lib/security-headers.ts` |
| Boot fails unless `APP_URL` is https in production | `apps/web/lib/env.ts` |
| Boot fails unless `DATABASE_URL` uses `sslmode=verify-full` in production | `apps/web/lib/env.ts` |

Infrastructure must also: terminate TLS 1.2+ only (TLS 1.3 preferred) with modern ciphers, use TLS for every internal hop (DB, cache, queues, object storage), and submit the domain to the HSTS preload list once stable.

## Encryption at rest

Two layers:

1. **Storage-level.** Turn on provider-managed AES-256 encryption with customer-managed keys for the database, backups, snapshots, object storage (invoice PDFs), and logs. This is infrastructure config.
2. **Application-level, field-level envelope encryption.** `packages/crypto`:
   - AES-256-GCM with a fresh data key (DEK) per value. A KMS-held key-encryption key (KEK) wraps each DEK.
   - The encryption context (`tenantId`, `table`, `column`, `id`) is bound as AAD, so a ciphertext copied to another row or tenant fails to decrypt.
   - Ciphertexts record their key ID, so KEKs can be rotated without breaking old data. `FieldEncryptor.keyIdOf()` finds values that need re-encryption.
   - Blind indexes (tenant-scoped HMAC-SHA256 with a separate key) allow exact-match lookups on encrypted fields such as tax IDs.

Encrypt at the application layer: vendor bank details (account/routing/IBAN/SWIFT), tax IDs (EIN/SSN/VAT), any PHI that appears on invoices (e.g. healthcare vendor line items), API tokens, and integration credentials.

```ts
import { encryptor, blindIndex } from "@/lib/encryption";

const ctx = {
  tenantId,
  table: "vendors",
  column: "bank_account",
  id: vendorId,
};
const stored = await encryptor.encrypt(iban, ctx);
const lookup = blindIndex(taxId, tenantId);
```

### Key management

- `ENCRYPTION_PROVIDER=local` (a keyring in env vars) is for dev/test only. **Boot fails if it's set in production.**
- Before go-live, implement `KeyProvider` against your cloud KMS (for example, AWS KMS `Encrypt`/`Decrypt` with `EncryptionContext`) in `apps/web/lib/encryption.ts`. Use separate keys per environment, turn on automatic yearly rotation, and keep access logs in CloudTrail or equivalent.
- To generate dev keys: `npm run keys:generate`.

## Control mapping

| Area | SOC 2 | ISO 27001:2022 | HIPAA |
| --- | --- | --- | --- |
| Encryption in transit | CC6.1, CC6.7 | A.8.20, A.8.21, A.8.24 | §164.312(e)(1), (e)(2)(ii) |
| Encryption at rest | CC6.1 | A.8.24 | §164.312(a)(2)(iv) |
| Key management | CC6.1 | A.8.24 | §164.312(a)(2)(iv) |
| Secure config / fail-closed | CC7.1, CC8.1 | A.8.9 | §164.308(a)(1) |
| Browser hardening (CSP etc.) | CC6.6 | A.8.26 | §164.312(c)(1) |

## Not yet done (next steps)

- WorkOS AuthKit (SSO/MFA, session cookies `Secure`/`HttpOnly`/`SameSite`), then RBAC and tenant isolation.
- Immutable audit log for access to and changes of encrypted fields (§164.312(b), CC7.2, A.8.15).
- KMS key provider, centralized logging with PII redaction, dependency scanning in CI, backup/restore testing.
