"use client";

import { useMemo, useState } from "react";

import {
  DataTable,
  DataTableBody,
  DataTableColumnToggle,
  DataTableContent,
  DataTableHeader,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
} from "@workspace/ui/components/ui/cubby-ui/data-table/data-table";
import { Filters } from "@workspace/ui/components/ui/cubby-ui/filters/filters";
import type { ColumnDef } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table";
import type {
  FilterField,
  FilterValue,
} from "@workspace/ui/components/ui/cubby-ui/filters/filters";

import type { FilterAccessors } from "@/lib/apply-filters";
import { applyFilters } from "@/lib/apply-filters";

/**
 * A sortable, searchable table with a filter bar above it. Filtering runs on
 * the client for now; swap `applyFilters` for a server query when rows come
 * from the database.
 */
export function FilterableTable<T extends { id: string }>({
  columns,
  data,
  fields,
  accessors,
  searchPlaceholder,
  emptyState = "No results.",
}: {
  readonly columns: ColumnDef<T>[];
  readonly data: T[];
  readonly fields: FilterField[];
  readonly accessors: FilterAccessors<T>;
  readonly searchPlaceholder?: string;
  readonly emptyState?: React.ReactNode;
}) {
  const [filters, setFilters] = useState<FilterValue[]>([]);
  const rows = useMemo(
    () => applyFilters(data, filters, fields, accessors),
    [data, filters, fields, accessors]
  );

  return (
    <div className="flex flex-col gap-3">
      <Filters fields={fields} value={filters} onValueChange={setFilters} />
      <DataTable
        columns={columns}
        data={rows}
        enableSorting
        enableFiltering
        enablePagination
        getRowId={(row) => row.id}
        className="md:max-w-none"
      >
        <DataTableToolbar>
          <DataTableSearch placeholder={searchPlaceholder} />
          <DataTableColumnToggle />
        </DataTableToolbar>
        <DataTableContent className="md:max-w-none">
          <DataTableHeader enableSorting />
          <DataTableBody emptyState={emptyState} />
        </DataTableContent>
        <DataTablePagination showSelectedCount={false} />
      </DataTable>
    </div>
  );
}
