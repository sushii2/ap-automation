"use client";

import { Badge } from "@workspace/ui/components/ui/cubby-ui/badge";
import type { ColumnDef } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table";
import type { FilterField } from "@workspace/ui/components/ui/cubby-ui/filters/filters";

import type { FilterAccessors } from "@/lib/apply-filters";
import type { Invoice, InvoiceStatus, PoMatch } from "@/lib/placeholder-data";
import { FilterableTable } from "@/components/filterable-table";
import { formatCurrency, formatDate } from "@/lib/format";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATUS: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> =
  {
    processing: { label: "Processing", variant: "info" },
    extracted: { label: "Extracted", variant: "success" },
    needs_review: { label: "Needs review", variant: "warning" },
    failed: { label: "Failed", variant: "danger" },
  };

const PO_MATCH: Record<PoMatch, { label: string; variant: BadgeVariant }> = {
  matched: { label: "Matched", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  unmatched: { label: "No match", variant: "neutral" },
};

const options = <T extends string>(map: Record<T, { label: string }>) =>
  (Object.keys(map) as T[]).map((value) => ({
    value,
    label: map[value].label,
  }));

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.invoiceNumber}</span>
    ),
  },
  { accessorKey: "vendor", header: "Vendor" },
  {
    accessorKey: "issuedAt",
    header: "Issued",
    cell: ({ row }) => formatDate(row.original.issuedAt),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { align: "right" as const },
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatCurrency(row.original.amount)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = STATUS[row.original.status];
      return <Badge variant={status.variant}>{status.label}</Badge>;
    },
  },
  {
    accessorKey: "extractionAccuracy",
    header: "Accuracy",
    meta: { align: "right" as const },
    sortUndefined: "last",
    cell: ({ row }) => {
      const accuracy = row.original.extractionAccuracy;
      return (
        <div className="text-right tabular-nums">
          {accuracy === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            `${accuracy.toFixed(1)}%`
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "indexed",
    header: "Indexed",
    cell: ({ row }) =>
      row.original.indexed ? (
        <Badge variant="success">Indexed</Badge>
      ) : (
        <Badge variant="neutral">Not indexed</Badge>
      ),
  },
  {
    accessorKey: "poMatch",
    header: "PO match",
    cell: ({ row }) => {
      const match = PO_MATCH[row.original.poMatch];
      return (
        <div className="flex items-center gap-2">
          <Badge variant={match.variant}>{match.label}</Badge>
          {!!row.original.poNumber && (
            <span className="text-muted-foreground">
              {row.original.poNumber}
            </span>
          )}
        </div>
      );
    },
  },
];

const fields: FilterField[] = [
  {
    id: "status",
    label: "Status",
    type: "multiselect",
    options: options(STATUS),
  },
  {
    id: "poMatch",
    label: "PO match",
    type: "multiselect",
    options: options(PO_MATCH),
  },
  {
    id: "indexed",
    label: "Indexed",
    type: "select",
    options: [
      { value: "yes", label: "Indexed" },
      { value: "no", label: "Not indexed" },
    ],
  },
  { id: "vendor", label: "Vendor", type: "text" },
  { id: "extractionAccuracy", label: "Accuracy", type: "number", suffix: "%" },
  { id: "amount", label: "Amount", type: "number", prefix: "$" },
];

const accessors: FilterAccessors<Invoice> = {
  status: (invoice) => invoice.status,
  poMatch: (invoice) => invoice.poMatch,
  indexed: (invoice) => (invoice.indexed ? "yes" : "no"),
  vendor: (invoice) => invoice.vendor,
  extractionAccuracy: (invoice) => invoice.extractionAccuracy,
  amount: (invoice) => invoice.amount,
};

export function InvoiceTable({ invoices }: { readonly invoices: Invoice[] }) {
  return (
    <FilterableTable
      columns={columns}
      data={invoices}
      fields={fields}
      accessors={accessors}
      searchPlaceholder="Search invoices"
      emptyState="No invoices match these filters."
    />
  );
}
