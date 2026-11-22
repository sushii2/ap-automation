import { requireOrganization } from "@/lib/auth"

export const metadata = { title: "Dashboard · AP Automation" }

export default async function DashboardPage() {
  const { user } = await requireOrganization()

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back{user.firstName ? `, ${user.firstName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Invoices and payments will show up here.
      </p>
    </>
  )
}
