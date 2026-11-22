"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, LogOut, Settings } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
]

const itemClass =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"

export function AppSidebar({
  user,
  signOutAction,
}: {
  user: { name: string; email: string }
  signOutAction: () => Promise<void>
}) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5 text-sm font-semibold">AP Automation</div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                itemClass,
                active && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border p-2">
        <div className="min-w-0 px-2.5 py-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          {user.name !== user.email && (
            <p className="truncate text-xs text-sidebar-foreground/60">
              {user.email}
            </p>
          )}
        </div>
        <form action={signOutAction}>
          <button type="submit" className={cn(itemClass, "cursor-pointer")}>
            <LogOut className="size-4" aria-hidden />
            Log out
          </button>
        </form>
      </div>
    </aside>
  )
}
