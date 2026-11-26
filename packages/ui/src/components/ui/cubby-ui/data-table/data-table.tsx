"use client";

import * as React from "react";
import { useTable, flexRender } from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpDownIcon,
  SortByDown01Icon,
  SortByUp01Icon,
} from "@hugeicons/core-free-icons";

import { elevatedSurface } from "@workspace/ui/lib/cubby-ui/elevated";
import { cn } from "@workspace/ui/lib/utils";
import { Checkbox } from "@workspace/ui/components/ui/cubby-ui/checkbox";
import {
  DataTableContext,
  dataTableFeatures,
  useDataTable,
} from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-context";
import { Toolbar } from "@workspace/ui/components/ui/cubby-ui/toolbar/toolbar";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@workspace/ui/components/ui/cubby-ui/table";

import type { TableProps } from "@workspace/ui/components/ui/cubby-ui/table";
import type { ToolbarProps } from "@workspace/ui/components/ui/cubby-ui/toolbar/toolbar";
import type { DataTableFeatures } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-context";
import type {
  ColumnDef as TanStackColumnDef,
  SortingState,
  RowSelectionState,
  ColumnFiltersState,
  PaginationState,
  ColumnVisibilityState,
  OnChangeFn,
  Row as TanStackRow,
  Column as TanStackColumn,
  RowData,
} from "@tanstack/react-table";

// TanStack v9 types take the table's feature set first. These bind it to
// DataTable's, so column definitions stay `ColumnDef<Row>[]`.
type ColumnDef<TData extends RowData, TValue = unknown> = TanStackColumnDef<
  DataTableFeatures,
  TData,
  TValue
>;
type Row<TData extends RowData> = TanStackRow<DataTableFeatures, TData>;
type Column<TData extends RowData, TValue = unknown> = TanStackColumn<
  DataTableFeatures,
  TData,
  TValue
>;
type VisibilityState = ColumnVisibilityState;

export interface DataTableProps<TData extends RowData, TValue> {
  readonly columns: ColumnDef<TData, TValue>[];
  readonly data: TData[];
  readonly children: React.ReactNode;
  readonly className?: string;

  readonly enableSorting?: boolean;
  readonly enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  readonly enableMultiRowSelection?: boolean;
  readonly enableFiltering?: boolean;
  readonly enablePagination?: boolean;

  readonly showSelectionColumn?: boolean;

  readonly sorting?: SortingState;
  readonly onSortingChange?: OnChangeFn<SortingState>;
  readonly rowSelection?: RowSelectionState;
  readonly onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  readonly columnFilters?: ColumnFiltersState;
  readonly onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  readonly pagination?: PaginationState;
  readonly onPaginationChange?: OnChangeFn<PaginationState>;
  readonly columnVisibility?: VisibilityState;
  readonly onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  readonly globalFilter?: string;
  readonly onGlobalFilterChange?: OnChangeFn<string>;

  readonly getRowId?: (
    originalRow: TData,
    index: number,
    parent?: Row<TData>
  ) => string;
}

function DataTable<TData extends RowData, TValue>({
  columns: userColumns,
  data,
  children,
  className,
  enableSorting = false,
  enableRowSelection = false,
  enableMultiRowSelection = true,
  enableFiltering = false,
  enablePagination = false,
  showSelectionColumn = true,
  sorting: controlledSorting,
  onSortingChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  pagination: controlledPagination,
  onPaginationChange,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    []
  );
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({});
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    });
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("");
  const [internalColumnVisibility, setInternalColumnVisibility] =
    React.useState<VisibilityState>({});

  const sorting = controlledSorting ?? internalSorting;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const pagination = controlledPagination ?? internalPagination;
  const globalFilter = controlledGlobalFilter ?? internalGlobalFilter;
  const columnVisibility =
    controlledColumnVisibility ?? internalColumnVisibility;

  // Columns of different value types only share a list typed `any`, the same
  // type v9's own `columnHelper.columns()` returns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = React.useMemo((): ColumnDef<TData, any>[] => {
    if (!enableRowSelection || !showSelectionColumn) {
      return userColumns;
    }

    const selectionColumn: ColumnDef<TData, unknown> = {
      id: "__select__",
      header: ({ table }) =>
        enableMultiRowSelection ? (
          <div className="flex items-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={
                table.getIsSomePageRowsSelected() &&
                !table.getIsAllPageRowsSelected()
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ) : null,
      cell: ({ row }) => (
        <div className="flex items-center">
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [selectionColumn, ...userColumns];
  }, [
    userColumns,
    enableRowSelection,
    enableMultiRowSelection,
    showSelectionColumn,
  ]);

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    state: {
      sorting,
      rowSelection,
      columnFilters,
      pagination,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onRowSelectionChange: onRowSelectionChange ?? setInternalRowSelection,
    onColumnFiltersChange: onColumnFiltersChange ?? setInternalColumnFilters,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
    onGlobalFilterChange: onGlobalFilterChange ?? setInternalGlobalFilter,
    onColumnVisibilityChange:
      onColumnVisibilityChange ?? setInternalColumnVisibility,
    // A disabled step passes rows through untouched.
    manualSorting: !enableSorting,
    manualFiltering: !enableFiltering,
    manualPagination: !enablePagination,
    enableRowSelection,
    enableMultiRowSelection,
    globalFilterFn: "includesString",
  });

  return (
    <DataTableContext.Provider value={{ table }}>
      <div
        className={cn(
          // `relative` required: elevatedSurface's rim ::after must position inside
          // this container, not climb to the nearest positioned ancestor.
          "relative w-full rounded-2xl md:max-w-2xl",
          // pseudo-element rim keeps the border line visible above opaque sticky
          // children (DataTableToolbar, table header) in dark mode.
          elevatedSurface(3, 1),
          "bg-muted",
          className
        )}
      >
        {children}
      </div>
    </DataTableContext.Provider>
  );
}

// A plain row above the table: its controls are fields and triggers, not
// toolbar buttons, so it skips the shell's fixed height and highlight.
function DataTableToolbar({
  className,
  variant = "ghost",
  highlight = false,
  ...props
}: ToolbarProps) {
  return (
    <Toolbar
      variant={variant}
      highlight={highlight}
      className={cn(
        "w-full items-center gap-1 rounded-b-none px-2 pt-2 pb-0 data-[orientation=horizontal]:h-auto",
        className
      )}
      {...props}
    />
  );
}

export interface DataTableContentProps extends Omit<TableProps, "children"> {
  readonly children: React.ReactNode;
}

function DataTableContent({
  bordered,
  striped,
  hoverable,
  rowDividers = true,
  className,
  children,
  ...tableProps
}: DataTableContentProps) {
  return (
    <Table
      bordered={bordered}
      striped={striped}
      hoverable={hoverable}
      rowDividers={rowDividers}
      className={cn(
        // Strips Table's own elevation; outer DataTable container owns it.
        // `after:hidden` removes the dark-mode rim ::after (would paint a
        // square-cornered rim over the DataTable's rounded one).
        "rounded-none bg-transparent shadow-none ring-0 after:hidden",
        className
      )}
      {...tableProps}
    >
      {children}
    </Table>
  );
}

function SortableHeader<TData extends RowData>({
  column,
  children,
  align,
  isFirst,
  isLast,
}: {
  readonly column: Column<TData, unknown>;
  readonly children: React.ReactNode;
  readonly align?: "left" | "center" | "right";
  readonly isFirst?: boolean;
  readonly isLast?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "group -mx-3 -my-2 flex w-[calc(100%+1.5rem)] cursor-pointer items-center gap-1.5 px-3 py-2 transition-colors hover:text-foreground",
        isFirst && "rounded-l-lg",
        isLast && "rounded-r-lg"
      )}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span
        className={cn(
          "flex flex-1 items-center",
          align === "right" && "justify-end",
          align === "center" && "justify-center"
        )}
      >
        {children}
      </span>
      {column.getIsSorted() === "asc" ? (
        <HugeiconsIcon
          icon={SortByUp01Icon}
          strokeWidth={2}
          className="size-4"
        />
      ) : column.getIsSorted() === "desc" ? (
        <HugeiconsIcon
          icon={SortByDown01Icon}
          strokeWidth={2}
          className="size-4"
        />
      ) : (
        <HugeiconsIcon
          icon={ArrowUpDownIcon}
          strokeWidth={2}
          className="size-4 opacity-0 group-hover:opacity-50"
        />
      )}
    </button>
  );
}

export interface DataTableHeaderProps extends React.ComponentProps<
  typeof TableHeader
> {
  readonly enableSorting?: boolean;
}

function DataTableHeader({
  enableSorting = false,
  className,
  ...props
}: DataTableHeaderProps) {
  const { table } = useDataTable();

  const renderHeader = (
    header: ReturnType<typeof table.getHeaderGroups>[0]["headers"][0],
    index: number,
    totalHeaders: number
  ) => {
    if (header.isPlaceholder) {
      return null;
    }

    const headerDef = header.column.columnDef.header;
    const canSort = header.column.getCanSort();
    const meta = header.column.columnDef.meta as
      { align?: "left" | "center" | "right" } | undefined;

    if (typeof headerDef === "string" && enableSorting && canSort) {
      return (
        <SortableHeader
          column={header.column}
          align={meta?.align}
          isFirst={index === 0}
          isLast={index === totalHeaders - 1}
        >
          {headerDef}
        </SortableHeader>
      );
    }

    return flexRender(headerDef, header.getContext());
  };

  return (
    <TableHeader className={className} {...props}>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header, index) => (
            <TableHead key={header.id} colSpan={header.colSpan}>
              {renderHeader(header, index, headerGroup.headers.length)}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  );
}

export interface DataTableBodyProps extends React.ComponentProps<
  typeof TableBody
> {
  readonly emptyState?: React.ReactNode;
}

function DataTableBody({
  emptyState,
  className,
  ...props
}: DataTableBodyProps) {
  const { table } = useDataTable();
  const totalColumns = table.getAllColumns().length;

  return (
    <TableBody className={className} {...props}>
      {table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} selected={row.getIsSelected()}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={totalColumns} className="h-24 text-center">
            {emptyState ?? "No results."}
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

export type DataTableFooterProps = React.ComponentProps<typeof TableFooter>;

function DataTableFooter({
  className,
  children,
  ...props
}: DataTableFooterProps) {
  return (
    <TableFooter className={className} {...props}>
      {children}
    </TableFooter>
  );
}

export {
  DataTable,
  DataTableToolbar,
  DataTableContent,
  DataTableHeader,
  DataTableBody,
  DataTableFooter,
};

export type { ColumnDef, Row, Column, VisibilityState };

export { ToolbarSeparator as DataTableToolbarSeparator } from "@workspace/ui/components/ui/cubby-ui/toolbar/toolbar";
export {
  useDataTable,
  type DataTableFeatures,
} from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-context";
export { DataTableSearch } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-search";
export { DataTableColumnToggle } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-column-toggle";
export { DataTablePagination } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table-pagination";
export {
  type SortingState,
  type RowSelectionState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
