import { getWorkOS, signOut, withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/cubby-ui/card"

import { OnboardingForm } from "./onboarding-form"

export const metadata = { title: "Select your organization · AP Automation" }

async function signOutAction() {
  "use server"
  await signOut()
}

export default async function OnboardingPage() {
  const { user, organizationId } = await withAuth({ ensureSignedIn: true })
  if (organizationId) redirect("/dashboard")

  const organizations = await getWorkOS()
    .organizations.listOrganizations({ limit: 100 })
    .then((list) => list.autoPagination())

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Select your organization</CardTitle>
            <CardDescription>
              Join the organization you work for, or create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              organizations={organizations
                .map(({ id, name }) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name))}
            />
          </CardContent>
        </Card>

        <form
          action={signOutAction}
          className="text-center text-sm text-muted-foreground"
        >
          Signed in as {user.email}.{" "}
          <button
            type="submit"
            className="cursor-pointer underline underline-offset-4 hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  )
}
