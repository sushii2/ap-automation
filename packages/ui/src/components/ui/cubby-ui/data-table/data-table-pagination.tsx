"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/ui/cubby-ui/button";
import { useDataTable } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-context";

interface DataTablePaginationProps {
  readonly className?: string;
  readonly showSelectedCount?: boolean;
}

function DataTablePagination({
  className,
  showSelectedCount = true,
}: DataTablePaginationProps) {
  const { table } = useDataTable();

  return (
    <div
      className={cn("flex items-center justify-between px-2 pb-2", className)}
    >
      {showSelectedCount ? (
        <span className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected
        </span>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export { DataTablePagination };
