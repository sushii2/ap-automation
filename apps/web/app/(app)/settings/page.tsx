import { getWorkOS } from "@workos-inc/authkit-nextjs"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/cubby-ui/card"

import { requireOrganization } from "@/lib/auth"
import { roleName } from "@/lib/roles"

import { DeleteAccount } from "./delete-account"

export const metadata = { title: "Settings · AP Automation" }

export default async function SettingsPage() {
  const { user, organizationId, role } = await requireOrganization()
  const organization = await getWorkOS()
    .organizations.getOrganization(organizationId)
    .catch(() => null)

  const rows = [
    ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ") || "—"],
    ["Email", user.email],
    ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Organization", organization?.name ?? organizationId],
    ["Role", roleName(role)],
  ]

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account details.
      </p>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Managed through WorkOS.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently deletes your account and removes you from your
            organization. If you are its only member, the organization is
            deleted too. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount email={user.email} />
        </CardContent>
      </Card>
    </>
  )
}
