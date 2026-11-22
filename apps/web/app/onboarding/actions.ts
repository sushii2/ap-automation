"use server"

import {
  getWorkOS,
  switchToOrganization,
  withAuth,
} from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { CREATOR_ROLE, JOINER_ROLE } from "@/lib/roles"

export type OnboardingState = { error?: string }

// Value of the "organization" radio that means "create a new one".
const NEW_ORGANIZATION = "new"

const nameSchema = z
  .string()
  .trim()
  .min(2, "Organization name must be at least 2 characters.")
  .max(100, "Organization name must be at most 100 characters.")

export async function selectOrganization(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const { user } = await withAuth({ ensureSignedIn: true })
  const workos = getWorkOS()

  const choice = formData.get("organization")
  if (typeof choice !== "string" || !choice) {
    return { error: "Select an organization to continue." }
  }

  let organizationId: string

  try {
    const memberships = await workos.userManagement
      .listOrganizationMemberships({ userId: user.id })
      .then((list) => list.autoPagination())

    // Onboarding is for users without an organization: one membership per user.
    const current = memberships[0]
    if (current && current.status !== "active") {
      return {
        error:
          "Your organization membership is not active. Ask an admin to restore it.",
      }
    }

    if (current) {
      organizationId = current.organizationId
    } else if (choice === NEW_ORGANIZATION) {
      const name = nameSchema.safeParse(formData.get("name"))
      if (!name.success) {
        return { error: name.error.issues[0]?.message ?? "Invalid name." }
      }

      const organizations = await workos.organizations
        .listOrganizations({ limit: 100 })
        .then((list) => list.autoPagination())
      const taken = organizations.some(
        (org) => org.name.trim().toLowerCase() === name.data.toLowerCase()
      )
      if (taken) {
        return {
          error: `"${name.data}" already exists. Select it from the list to join.`,
        }
      }

      const organization = await workos.organizations.createOrganization({
        name: name.data,
      })
      try {
        await workos.userManagement.createOrganizationMembership({
          organizationId: organization.id,
          userId: user.id,
          roleSlug: CREATOR_ROLE,
        })
      } catch (error) {
        // Don't leave behind an organization nobody administers.
        await workos.organizations
          .deleteOrganization(organization.id)
          .catch(() => {})
        throw error
      }
      organizationId = organization.id
    } else {
      // Throws if the id doesn't name a real organization.
      const organization = await workos.organizations.getOrganization(choice)
      await workos.userManagement.createOrganizationMembership({
        organizationId: organization.id,
        userId: user.id,
        roleSlug: JOINER_ROLE,
      })
      organizationId = organization.id
    }
  } catch (error) {
    console.error("Onboarding failed", error)
    return { error: "Something went wrong. Please try again." }
  }

  // Re-issues the session scoped to the organization, then redirects.
  await switchToOrganization(organizationId, { returnTo: "/dashboard" })
  return {}
}
