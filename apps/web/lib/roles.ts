// Out-of-the-box roles, ordered from most to least privileged.
// Slugs must exist as environment roles in WorkOS: `npm run workos:roles -w web`.
export const ROLES = [
  {
    slug: "admin",
    name: "Admin",
    description: "Full access, including members and organization settings.",
  },
  {
    slug: "editor",
    name: "Editor",
    description: "Create, edit and approve invoices and payments.",
  },
  {
    slug: "user",
    name: "User",
    description: "Create and edit their own invoices.",
  },
  {
    slug: "viewer",
    name: "Viewer",
    description: "Read-only access.",
  },
] as const;

export type RoleSlug = (typeof ROLES)[number]["slug"];

// Whoever creates an organization runs it; self-joiners start read-only.
export const CREATOR_ROLE: RoleSlug = "admin";
export const JOINER_ROLE: RoleSlug = "viewer";

export function roleName(slug: string | undefined) {
  return ROLES.find((role) => role.slug === slug)?.name ?? slug ?? "—";
}
