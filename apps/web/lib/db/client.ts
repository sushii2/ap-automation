import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.ts";

// Used by both the Next.js server and Trigger.dev tasks, so it reads
// process.env directly instead of going through lib/env.ts (server-only).

const createDb = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  // Queries go over HTTPS, so there is no connection pool to manage.
  return drizzle({ client: neon(url), schema });
};

const cache: { db?: ReturnType<typeof createDb> } = {};

/**
The database client, created on first use so importing this never throws.
*/
export const getDb = () => {
  cache.db ??= createDb();
  return cache.db;
};
