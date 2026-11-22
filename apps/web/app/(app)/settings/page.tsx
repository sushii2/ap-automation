import { withAuth } from "@workos-inc/authkit-nextjs"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/cubby-ui/card"

export const metadata = { title: "Settings · AP Automation" }

export default async function SettingsPage() {
  const { user, organizationId, role } = await withAuth({
    ensureSignedIn: true,
  })

  const rows = [
    ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ") || "—"],
    ["Email", user.email],
    ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Organization", organizationId ?? "—"],
    ["Role", role ?? "—"],
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
    </>
  )
}
