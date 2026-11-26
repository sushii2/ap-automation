import type { ExtractedInvoice } from "./invoice-schema.ts";
import type { ExtractedPurchaseOrder } from "./purchase-order-schema.ts";

// Pure helpers that turn an extracted document into the text that is embedded and the metadata stored next to the vector. No I/O, so they are unit-tested.

// Routed through Vercel AI Gateway. 1536 dimensions; see EMBEDDING_DIMENSIONS.
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export interface EmbeddingMetadata {
  documentType: "invoice" | "purchase_order";
  organizationId: string;
  fileName: string;
  documentNumber: string | null;
  purchaseOrderNumber: string | null;
  vendorName: string | null;
  counterpartyName: string | null;
  documentDate: string | null;
  currency: string | null;
  totalAmount: number | null;
  lineItemCount: number;
}

export interface EmbeddingInput {
  content: string;
  metadata: EmbeddingMetadata;
}

interface DocumentContext {
  organizationId: string;
  fileName: string;
}

interface Line {
  itemCode?: string | null;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

const NON_ALPHANUMERIC = /[^A-Z0-9]/gu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Reduces a PO number to upper-case alphanumerics so that "PO-7731", "po 7731" and "PO/7731" all compare equal. Null when nothing is left.
 */
export const normalizePoNumber = (value: string | null) => {
  const normalized = value?.toUpperCase().replaceAll(NON_ALPHANUMERIC, "");
  return normalized || null;
};

/**
The model is asked for YYYY-MM-DD; anything else is not stored as a date.
*/
export const toIsoDate = (value: string | null) => {
  if (!value || !ISO_DATE.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  const isRealDate =
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
  return isRealDate ? value : null;
};

const field = (label: string, value: string | number | null) =>
  value === null || value === "" ? null : `${label}: ${value}`;

const lineText = (line: Line) => {
  const parts = [line.itemCode, line.description].filter(Boolean).join(" ");
  const figures = [
    field("qty", line.quantity),
    field("unit price", line.unitPrice),
    field("amount", line.amount),
  ].filter((part) => part !== null);
  return figures.length > 0
    ? `- ${parts} (${figures.join(", ")})`
    : `- ${parts}`;
};

// Tax IDs and emails are deliberately left out: the content is stored in
// plaintext and sent to the embedding provider.
const compose = (header: (string | null)[], lines: Line[]) => {
  const sections = [header.filter((part) => part !== null).join("\n")];
  if (lines.length > 0) {
    sections.push(
      `Line items:\n${lines.map((line) => lineText(line)).join("\n")}`
    );
  }
  return sections.join("\n\n");
};

export const invoiceEmbeddingInput = (
  invoice: ExtractedInvoice,
  { organizationId, fileName }: DocumentContext
): EmbeddingInput => ({
  content: compose(
    [
      "Invoice",
      field("Invoice number", invoice.invoiceNumber),
      field("Purchase order number", invoice.purchaseOrderNumber),
      field("Vendor", invoice.vendor.name),
      field("Vendor address", invoice.vendor.address),
      field("Customer", invoice.customer.name),
      field("Customer address", invoice.customer.address),
      field("Invoice date", invoice.invoiceDate),
      field("Due date", invoice.dueDate),
      field("Payment terms", invoice.paymentTerms),
      field("Currency", invoice.currency),
      field("Subtotal", invoice.subtotal),
      field("Tax", invoice.taxAmount),
      field("Total", invoice.totalAmount),
    ],
    invoice.lineItems
  ),
  metadata: {
    organizationId,
    fileName,
    documentType: "invoice",
    documentNumber: invoice.invoiceNumber,
    purchaseOrderNumber: invoice.purchaseOrderNumber,
    vendorName: invoice.vendor.name,
    counterpartyName: invoice.customer.name,
    documentDate: toIsoDate(invoice.invoiceDate),
    currency: invoice.currency,
    totalAmount: invoice.totalAmount,
    lineItemCount: invoice.lineItems.length,
  },
});

export const purchaseOrderEmbeddingInput = (
  order: ExtractedPurchaseOrder,
  { organizationId, fileName }: DocumentContext
): EmbeddingInput => ({
  content: compose(
    [
      "Purchase order",
      field("Purchase order number", order.poNumber),
      field("Vendor", order.vendor.name),
      field("Vendor address", order.vendor.address),
      field("Buyer", order.buyer.name),
      field("Buyer address", order.buyer.address),
      field("Ship to", order.shipTo.name),
      field("Ship to address", order.shipTo.address),
      field("Order date", order.orderDate),
      field("Delivery date", order.deliveryDate),
      field("Payment terms", order.paymentTerms),
      field("Currency", order.currency),
      field("Subtotal", order.subtotal),
      field("Tax", order.taxAmount),
      field("Shipping", order.shippingAmount),
      field("Total", order.totalAmount),
    ],
    order.lineItems
  ),
  metadata: {
    organizationId,
    fileName,
    documentType: "purchase_order",
    documentNumber: order.poNumber,
    purchaseOrderNumber: order.poNumber,
    vendorName: order.vendor.name,
    counterpartyName: order.buyer.name,
    documentDate: toIsoDate(order.orderDate),
    currency: order.currency,
    totalAmount: order.totalAmount,
    lineItemCount: order.lineItems.length,
  },
});
