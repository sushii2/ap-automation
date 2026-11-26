"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { z } from "zod";

import { Badge } from "@workspace/ui/components/ui/cubby-ui/badge";
import { Button } from "@workspace/ui/components/ui/cubby-ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/ui/cubby-ui/drawer/drawer";
import {
  Field,
  FieldControl,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/ui/cubby-ui/field";
import { Form } from "@workspace/ui/components/ui/cubby-ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/cubby-ui/select";
import { Textarea } from "@workspace/ui/components/ui/cubby-ui/textarea";
import type { FilterField } from "@workspace/ui/components/ui/cubby-ui/filters/filters";
import type { ColumnDef } from "@workspace/ui/components/ui/cubby-ui/data-table/data-table";

import type { FilterAccessors } from "@/lib/apply-filters";
import type {
  PurchaseOrder,
  PurchaseOrderSource,
  PurchaseOrderStatus,
} from "@/lib/placeholder-data";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { FilterableTable } from "@/components/filterable-table";
import { DocumentUpload } from "@/components/document-upload";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATUS: Record<
  PurchaseOrderStatus,
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "Open", variant: "info" },
  partially_received: { label: "Partially received", variant: "warning" },
  closed: { label: "Closed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

const SOURCE: Record<PurchaseOrderSource, string> = {
  upload: "Uploaded",
  manual: "Entered manually",
};

const statusOptions = (Object.keys(STATUS) as PurchaseOrderStatus[]).map(
  (value) => ({ value, label: STATUS[value].label })
);

const columns: ColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: "poNumber",
    header: "PO number",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.poNumber}</span>
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
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => SOURCE[row.original.source],
  },
  {
    accessorKey: "matchedInvoices",
    header: "Matched invoices",
    meta: { align: "right" as const },
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.matchedInvoices}
      </div>
    ),
  },
];

const fields: FilterField[] = [
  {
    id: "status",
    label: "Status",
    type: "multiselect",
    options: statusOptions,
  },
  {
    id: "source",
    label: "Source",
    type: "select",
    options: (Object.keys(SOURCE) as PurchaseOrderSource[]).map((value) => ({
      value,
      label: SOURCE[value],
    })),
  },
  { id: "vendor", label: "Vendor", type: "text" },
  { id: "amount", label: "Amount", type: "number", prefix: "$" },
  { id: "matchedInvoices", label: "Matched invoices", type: "number" },
];

const accessors: FilterAccessors<PurchaseOrder> = {
  status: (order) => order.status,
  source: (order) => order.source,
  vendor: (order) => order.vendor,
  amount: (order) => order.amount,
  matchedInvoices: (order) => order.matchedInvoices,
};

const schema = z.object({
  poNumber: z.string().trim().min(1, "Enter a PO number").max(50),
  vendor: z.string().trim().min(1, "Enter a vendor").max(200),
  amount: z.coerce
    .number({ message: "Enter an amount" })
    .positive("Amount must be greater than zero"),
  issuedAt: z.iso.date("Pick an issue date"),
  status: z.enum(["open", "partially_received", "closed", "cancelled"]),
  notes: z.string().max(2000).optional(),
});

/**
Which drawer the `?new=` search param opens.
*/
type DrawerMode = "manual" | "upload";

export function PurchaseOrders({
  initial,
}: {
  readonly initial: PurchaseOrder[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("new");
  const mode: DrawerMode | null =
    param === "manual" || param === "upload" ? param : null;

  // TODO: persist through a server action once purchase orders have a table.
  const [orders, setOrders] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const open = (next: DrawerMode) => router.push(`${pathname}?new=${next}`);
  const close = () => {
    setErrors({});
    router.replace(pathname);
  };

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Upload purchase orders or enter them by hand so invoices can be matched against them."
      >
        <Button
          variant="outline"
          onClick={() => open("upload")}
          leadingIcon={<Upload aria-hidden />}
        >
          Upload PO
        </Button>
        <Button
          onClick={() => open("manual")}
          leadingIcon={<Plus aria-hidden />}
        >
          New purchase order
        </Button>
      </PageHeader>

      <FilterableTable
        columns={columns}
        data={orders}
        fields={fields}
        accessors={accessors}
        searchPlaceholder="Search purchase orders"
        emptyState="No purchase orders match these filters."
      />

      <Drawer
        direction="right"
        open={mode === "manual"}
        onOpenChange={(next) => !next && close()}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New purchase order</DrawerTitle>
            <DrawerDescription>
              Enter the details from the purchase order.
            </DrawerDescription>
          </DrawerHeader>
          <Form
            id="purchase-order-form"
            className="contents"
            errors={errors}
            onFormSubmit={(values) => {
              const result = schema.safeParse(values);
              if (!result.success) {
                setErrors(z.flattenError(result.error).fieldErrors);
                return;
              }
              const { notes: _notes, ...order } = result.data;
              setOrders((current) => [
                {
                  ...order,
                  id: `po_${crypto.randomUUID()}`,
                  source: "manual",
                  matchedInvoices: 0,
                },
                ...current,
              ]);
              close();
            }}
          >
            <DrawerBody>
              <div className="flex flex-col gap-4">
                <Field name="poNumber">
                  <FieldLabel>PO number</FieldLabel>
                  <FieldControl required placeholder="PO-0000" />
                  <FieldError />
                </Field>
                <Field name="vendor">
                  <FieldLabel>Vendor</FieldLabel>
                  <FieldControl
                    required
                    autoComplete="organization"
                    placeholder="Acme Inc."
                  />
                  <FieldError />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field name="amount">
                    <FieldLabel>Amount (USD)</FieldLabel>
                    <FieldControl
                      required
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                    />
                    <FieldError />
                  </Field>
                  <Field name="issuedAt">
                    <FieldLabel>Issue date</FieldLabel>
                    <FieldControl required type="date" />
                    <FieldError />
                  </Field>
                </div>
                <Field name="status">
                  <FieldLabel>Status</FieldLabel>
                  <Select items={statusOptions} defaultValue="open">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError />
                </Field>
                <Field name="notes">
                  <FieldLabel>Notes</FieldLabel>
                  <FieldControl
                    render={<Textarea rows={3} />}
                    placeholder="Optional"
                  />
                  <FieldError />
                </Field>
              </div>
            </DrawerBody>
          </Form>
          <DrawerFooter>
            <Button type="submit" form="purchase-order-form">
              Add purchase order
            </Button>
            <DrawerClose render={<Button variant="outline" />}>
              Cancel
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        direction="right"
        open={mode === "upload"}
        onOpenChange={(next) => !next && close()}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Upload purchase orders</DrawerTitle>
            <DrawerDescription>
              We extract the details and add them to this list.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <DocumentUpload
              kind="purchase_order"
              title="Drop purchase orders here or click to browse"
            />
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>
              Done
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
