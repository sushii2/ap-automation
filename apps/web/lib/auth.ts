import "server-only";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

/**
Signed-in user with an organization selected; otherwise sends them to onboarding.
*/
export async function requireOrganization() {
  const auth = await withAuth({ ensureSignedIn: true });
  if (!auth.organizationId) {
    redirect("/onboarding");
  }
  return { ...auth, organizationId: auth.organizationId };
}
