import "server-only";

import { z } from "zod";

// Production guards run when the server boots (instrumentation.ts), not during `next build`.
const isProd =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

// Vercel preview (staging) deployments run with NODE_ENV=production but hold no
// production data, so they may use a staging-only local keyring until KMS exists.
const isVercelPreview = process.env.VERCEL_ENV === "preview";

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.url(),

    // Encryption at rest (application-layer, field-level envelope encryption).
    // "local" = keyring in env, dev/test only. Production must use a KMS-backed provider.
    ENCRYPTION_PROVIDER: z.enum(["local", "kms"]).default("local"),
    ENCRYPTION_KEYRING: z.string().optional(),
    ENCRYPTION_ACTIVE_KEY_ID: z.string().optional(),
    BLIND_INDEX_KEY: z
      .string()
      .min(44, "BLIND_INDEX_KEY must be a base64 32-byte key"),

    // Database connections must verify the server certificate (TLS in transit).
    DATABASE_URL: z.string().optional(),

    // WorkOS AuthKit (read from process.env by @workos-inc/authkit-nextjs).
    WORKOS_API_KEY: z.string().min(1),
    WORKOS_CLIENT_ID: z.string().min(1),
    WORKOS_COOKIE_PASSWORD: z
      .string()
      .min(32, "WORKOS_COOKIE_PASSWORD must be at least 32 characters"),
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.url(),
  })
  .superRefine((env, ctx) => {
    if (isProd && !env.APP_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "must be https in production",
      });
    }
    if (isProd && !env.NEXT_PUBLIC_WORKOS_REDIRECT_URI.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_WORKOS_REDIRECT_URI"],
        message: "must be https in production",
      });
    }
    if (isProd && !isVercelPreview && env.ENCRYPTION_PROVIDER === "local") {
      ctx.addIssue({
        code: "custom",
        path: ["ENCRYPTION_PROVIDER"],
        message:
          "local keyring is not allowed in production; use a KMS-backed provider",
      });
    }
    if (
      env.ENCRYPTION_PROVIDER === "local" &&
      (!env.ENCRYPTION_KEYRING || !env.ENCRYPTION_ACTIVE_KEY_ID)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ENCRYPTION_KEYRING"],
        message:
          "ENCRYPTION_KEYRING and ENCRYPTION_ACTIVE_KEY_ID are required for the local provider",
      });
    }
    if (
      isProd &&
      env.DATABASE_URL &&
      !/[?&]sslmode=verify-full\b/.test(env.DATABASE_URL)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "must use sslmode=verify-full in production",
      });
    }
  });

export const env = schema.parse(process.env);
