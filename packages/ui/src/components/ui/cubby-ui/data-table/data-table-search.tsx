"use client";

import * as React from "react";
import { Toolbar } from "@base-ui/react/toolbar";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@workspace/ui/lib/utils";
import { useDataTable } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-context";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/ui/cubby-ui/input-group";

interface DataTableSearchProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "size"
> {
  readonly placeholder?: string;
  readonly size?: "default" | "sm";
}

function DataTableSearch({
  placeholder = "Search and filter",
  size = "sm",
  className,
  ...props
}: DataTableSearchProps) {
  const { table } = useDataTable();

  return (
    <InputGroup className="flex-1 border-0 bg-transparent shadow-none outline-none! dark:bg-transparent">
      <InputGroupAddon>
        <HugeiconsIcon
          icon={Search01Icon}
          className="size-4 text-muted-foreground"
          strokeWidth={2}
        />
      </InputGroupAddon>
      <InputGroupInput
        placeholder={placeholder}
        size={size}
        value={table.state.globalFilter ?? ""}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        className={cn("py-0", className)}
        render={<Toolbar.Input />}
        {...props}
      />
    </InputGroup>
  );
}

export { DataTableSearch };
