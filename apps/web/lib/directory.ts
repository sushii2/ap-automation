import "server-only";

import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { organizationMemberships, organizations, users } from "@/lib/db/schema";
import { JOINER_ROLE } from "@/lib/roles";

// WorkOS owns users, organizations and memberships.
// These copies exist so the documents in our database can reference who they belong to.

interface DirectoryUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Makes sure the user, their organization and the membership between them exist in our database and are up to date.
 * Safe to call repeatedly.
 */
export const syncMembership = async ({
  user,
  organizationId,
  role = JOINER_ROLE,
}: {
  user: DirectoryUser;
  organizationId: string;
  role?: string;
}) => {
  const db = getDb();
  const profile = {
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  };
  await db
    .insert(users)
    .values({ id: user.id, ...profile })
    .onConflictDoUpdate({ set: profile, target: users.id });

  // The session carries the organization's ID but not its name: ask WorkOS
  // for it once, the first time we see the organization.
  const [known] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!known) {
    const { name } =
      await getWorkOS().organizations.getOrganization(organizationId);
    await db
      .insert(organizations)
      .values({ name, id: organizationId })
      .onConflictDoNothing();
  }

  await db
    .insert(organizationMemberships)
    .values({ organizationId, role, userId: user.id })
    .onConflictDoUpdate({
      set: { role },
      target: [
        organizationMemberships.organizationId,
        organizationMemberships.userId,
      ],
    });
};

/**
Removes a deleted user; their memberships go with them, their documents stay.
*/
export const removeUser = async (userId: string) => {
  await getDb().delete(users).where(eq(users.id, userId));
};
