"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChartColumn,
  FilePlus,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  ShoppingCart,
  SunMoon,
  Upload,
} from "lucide-react";

import {
  Command,
  CommandCollection,
  CommandContent,
  CommandDialog,
  CommandDialogPopup,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/ui/cubby-ui/command";
import { Kbd } from "@workspace/ui/components/ui/cubby-ui/kbd";
import type { LucideIcon } from "lucide-react";

interface CommandEntry {
  value: string;
  label: string;
  icon: LucideIcon;
  /**
  A route to open, or `theme` to switch between light and dark.
  */
  action: "theme" | { href: string };
}

interface CommandGroupData {
  label: string;
  items: CommandEntry[];
}

const GROUPS: CommandGroupData[] = [
  {
    label: "Actions",
    items: [
      {
        value: "upload-invoice",
        label: "Upload invoice",
        icon: Upload,
        action: { href: "/upload" },
      },
      {
        value: "new-purchase-order",
        label: "New purchase order",
        icon: FilePlus,
        action: { href: "/purchase-orders?new=manual" },
      },
      {
        value: "upload-purchase-order",
        label: "Upload purchase order",
        icon: Upload,
        action: { href: "/purchase-orders?new=upload" },
      },
      {
        value: "toggle-theme",
        label: "Toggle theme",
        icon: SunMoon,
        action: "theme",
      },
    ],
  },
  {
    label: "Go to",
    items: [
      {
        value: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        action: { href: "/dashboard" },
      },
      {
        value: "invoices",
        label: "Invoice log",
        icon: FileText,
        action: { href: "/invoices" },
      },
      {
        value: "purchase-orders",
        label: "Purchase orders",
        icon: ShoppingCart,
        action: { href: "/purchase-orders" },
      },
      {
        value: "analytics",
        label: "Analytics",
        icon: ChartColumn,
        action: { href: "/analytics" },
      },
      {
        value: "settings",
        label: "Settings",
        icon: Settings,
        action: { href: "/settings" },
      },
    ],
  },
];

/**
The ⌘K command palette, with the sidebar button that opens it.
*/
export function CommandMenu({ className }: { readonly className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      )) {
        return;
      }

      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function run({ action }: CommandEntry) {
    setOpen(false);
    if (action === "theme") {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    } else {
      router.push(action.href);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Search className="size-4" aria-hidden />
        Search
        <Kbd keys={["mod", "k"]} className="ml-auto" />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup>
          <Command items={GROUPS} open={open}>
            <CommandContent>
              <CommandInput placeholder="Type a command or search…" />
              <CommandList emptyMessage="No results found.">
                {(group: CommandGroupData, index: number) => (
                  <Fragment key={group.label}>
                    {index > 0 && <CommandSeparator />}
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: CommandEntry) => (
                          <CommandItem
                            key={item.value}
                            value={item.value}
                            onClick={() => run(item)}
                          >
                            <item.icon aria-hidden />
                            <span>{item.label}</span>
                          </CommandItem>
                        )}
                      </CommandCollection>
                    </CommandGroup>
                  </Fragment>
                )}
              </CommandList>
            </CommandContent>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}
