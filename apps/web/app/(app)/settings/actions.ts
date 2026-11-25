"use server";

import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface DeleteAccountState {
  error?: string;
}

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const { user, impersonator } = await withAuth({ ensureSignedIn: true });

  if (impersonator) {
    return { error: "Accounts cannot be deleted while impersonating." };
  }

  const confirmation = formData.get("confirmation");
  if (
    typeof confirmation !== "string" ||
    confirmation.trim().toLowerCase() !== user.email.toLowerCase()
  ) {
    return { error: "Type your email address exactly to confirm." };
  }

  const workos = getWorkOS();

  try {
    const memberships = await workos.userManagement
      .listOrganizationMemberships({ userId: user.id })
      .then((list) => list.autoPagination());

    // Organizations that would be left with no members at all.
    const emptiedOrganizationIds: string[] = [];

    for (const membership of memberships) {
      const others = await workos.userManagement
        .listOrganizationMemberships({
          organizationId: membership.organizationId,
        })
        .then((list) => list.autoPagination())
        .then((list) => list.filter((m) => m.userId !== user.id));

      if (others.length === 0) {
        emptiedOrganizationIds.push(membership.organizationId);
        continue;
      }

      const isAdmin = (m: (typeof others)[number]) =>
        m.role.slug === "admin" || m.roles?.some((r) => r.slug === "admin");
      const anotherAdmin = others.some(
        (m) => m.status === "active" && isAdmin(m)
      );
      if (isAdmin(membership) && !anotherAdmin) {
        return {
          error: `You are the only Admin of ${membership.organizationName ?? "your organization"}. Make another member an Admin before deleting your account.`,
        };
      }
    }

    // Removes the user, their memberships and all of their sessions.
    await workos.userManagement.deleteUser(user.id);

    await Promise.allSettled(
      emptiedOrganizationIds.map((id) =>
        workos.organizations.deleteOrganization(id)
      )
    );
  } catch (error) {
    console.error("Account deletion failed", error);
    return { error: "Could not delete your account. Please try again." };
  }

  // The WorkOS session is already gone, so just drop the cookie.
  const cookieStore = await cookies();
  cookieStore.delete(process.env.WORKOS_COOKIE_NAME || "wos-session");
  redirect("/");
}
