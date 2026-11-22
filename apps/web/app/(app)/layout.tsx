import { signOut, withAuth } from "@workos-inc/authkit-nextjs"

import { AppSidebar } from "@/components/app-sidebar"

async function signOutAction() {
  "use server"
  await signOut()
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await withAuth({ ensureSignedIn: true })
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ")

  return (
    <div className="flex min-h-svh">
      <AppSidebar
        user={{ name: name || user.email, email: user.email }}
        signOutAction={signOutAction}
      />
      <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
    </div>
  )
}
