/* eslint-disable unicorn/no-top-level-side-effects -- a CLI config file: loading the env file is its job */
import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Migrations need a direct connection; the pooled URL goes through pgbouncer.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL in .env.local.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
