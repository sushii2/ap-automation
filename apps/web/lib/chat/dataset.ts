import { asc, eq } from "drizzle-orm";

import { getDb } from "../db/client.ts";
import { invoices, purchaseOrders } from "../db/schema.ts";

// The copy of an organization's documents that a chat session works from.
// It is uploaded to the model provider, so it carries only what analysis needs: no tax IDs, no contact emails, no embeddings, no storage paths.
// The field names here are described to the agent in lib/chat/agent-config.ts.

const shared = (table: typeof invoices | typeof purchaseOrders) => ({
  id: table.id,
  vendorName: table.vendorName,
  vendor: table.vendor,
  currency: table.currency,
  paymentTerms: table.paymentTerms,
  subtotal: table.subtotal,
  taxAmount: table.taxAmount,
  totalAmount: table.totalAmount,
  lineItems: table.lineItems,
  extractionConfidence: table.extractionConfidence,
  warnings: table.warnings,
  notes: table.notes,
  fileName: table.fileName,
  createdAt: table.createdAt,
});

type SharedRow = Pick<
  typeof invoices.$inferSelect,
  keyof ReturnType<typeof shared>
>;

const sharedFields = (row: SharedRow) => ({
  currency: row.currency,
  paymentTerms: row.paymentTerms,
  subtotal: row.subtotal,
  taxAmount: row.taxAmount,
  totalAmount: row.totalAmount,
  lineItems: row.lineItems,
  extractionConfidence: row.extractionConfidence,
  warnings: row.warnings,
  notes: row.notes,
  fileName: row.fileName,
  uploadedAt: row.createdAt.toISOString(),
});

/**
 * Every invoice and purchase order of one organization, oldest first, shaped for the chat agent.
 */
export const loadChatDataset = async (organizationId: string) => {
  const db = getDb();
  const invoiceColumns = {
    ...shared(invoices),
    invoiceNumber: invoices.invoiceNumber,
    invoiceDate: invoices.invoiceDate,
    dueDate: invoices.dueDate,
    customerName: invoices.customerName,
    customer: invoices.customer,
    amountDue: invoices.amountDue,
    purchaseOrderNumber: invoices.purchaseOrderNumber,
    purchaseOrderId: invoices.purchaseOrderId,
    poMatchMethod: invoices.poMatchMethod,
    poMatchScore: invoices.poMatchScore,
  };

  const purchaseOrderColumns = {
    ...shared(purchaseOrders),
    poNumber: purchaseOrders.poNumber,
    orderDate: purchaseOrders.orderDate,
    deliveryDate: purchaseOrders.deliveryDate,
    buyerName: purchaseOrders.buyerName,
    buyer: purchaseOrders.buyer,
    shipTo: purchaseOrders.shipTo,
    shippingAmount: purchaseOrders.shippingAmount,
  };

  const [invoiceRows, orderRows] = await Promise.all([
    db
      .select(invoiceColumns)
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .orderBy(asc(invoices.createdAt)),
    db
      .select(purchaseOrderColumns)
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, organizationId))
      .orderBy(asc(purchaseOrders.createdAt)),
  ]);

  return {
    invoices: invoiceRows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      vendorName: row.vendorName,
      vendorAddress: row.vendor.address,
      customerName: row.customerName,
      customerAddress: row.customer.address,
      amountDue: row.amountDue,
      purchaseOrderNumber: row.purchaseOrderNumber,
      purchaseOrderId: row.purchaseOrderId,
      poMatchMethod: row.poMatchMethod,
      poMatchScore: row.poMatchScore,
      ...sharedFields(row),
    })),
    purchaseOrders: orderRows.map((row) => ({
      id: row.id,
      poNumber: row.poNumber,
      orderDate: row.orderDate,
      deliveryDate: row.deliveryDate,
      vendorName: row.vendorName,
      vendorAddress: row.vendor.address,
      buyerName: row.buyerName,
      buyerAddress: row.buyer.address,
      shipTo: row.shipTo,
      shippingAmount: row.shippingAmount,
      ...sharedFields(row),
    })),
  };
};

export type ChatDataset = Awaited<ReturnType<typeof loadChatDataset>>;
