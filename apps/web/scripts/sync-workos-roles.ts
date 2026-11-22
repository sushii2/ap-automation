// Creates the app's roles as WorkOS environment roles. Safe to re-run.
// Usage: npm run workos:roles -w web
import { WorkOS } from "@workos-inc/node"

import { ROLES } from "../lib/roles.ts"

const apiKey = process.env.WORKOS_API_KEY
if (!apiKey) {
  console.error("WORKOS_API_KEY is not set (expected in apps/web/.env.local)")
  process.exit(1)
}

const workos = new WorkOS(apiKey)
const existing = new Set(
  (await workos.authorization.listEnvironmentRoles()).data.map(
    (role) => role.slug
  )
)

for (const { slug, name, description } of ROLES) {
  if (existing.has(slug)) {
    console.log(`= ${slug} (already exists)`)
    continue
  }
  await workos.authorization.createEnvironmentRole({ slug, name, description })
  console.log(`+ ${slug}`)
}
