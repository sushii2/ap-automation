import "server-only";

import { count, desc, eq, isNotNull } from "drizzle-orm";

import { PO_MATCH_WARNING_PREFIX } from "../po-matching.ts";
import { getDb } from "./client.ts";
import { invoices, purchaseOrders } from "./schema.ts";

// The rows behind the invoice log and the purchase order table.

const PERCENT = 100;

export type InvoiceStatus = "extracted" | "needs_review";
export type PoMatch = "matched" | "partial" | "unmatched";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string | null;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  issuedAt: string | null;
  status: InvoiceStatus;
  /**
  0–100, null when the extraction reported no confidence.
  */
  extractionAccuracy: number | null;
  indexed: boolean;
  poMatch: PoMatch;
  poNumber: string | null;
}

export type PurchaseOrderStatus =
  "open" | "partially_received" | "closed" | "cancelled";
export type PurchaseOrderSource = "upload" | "manual";

export interface PurchaseOrderRow {
  id: string;
  poNumber: string | null;
  fileName: string | null;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  issuedAt: string | null;
  /**
  Null for uploaded purchase orders: the document does not say.
  */
  status: PurchaseOrderStatus | null;
  source: PurchaseOrderSource;
  matchedInvoices: number;
}

const toPoMatch = (isLinked: boolean, warnings: string[]): PoMatch => {
  if (!isLinked) {
    return "unmatched";
  }
  const hasMismatch = warnings.some((warning) =>
    warning.startsWith(PO_MATCH_WARNING_PREFIX)
  );
  return hasMismatch ? "partial" : "matched";
};

/**
Every invoice of one organization, newest first.
*/
export const listInvoices = async (
  organizationId: string
): Promise<InvoiceRow[]> => {
  const rows = await getDb()
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      fileName: invoices.fileName,
      vendorName: invoices.vendorName,
      totalAmount: invoices.totalAmount,
      currency: invoices.currency,
      invoiceDate: invoices.invoiceDate,
      extractionConfidence: invoices.extractionConfidence,
      warnings: invoices.warnings,
      isIndexed: isNotNull(invoices.embedding),
      purchaseOrderId: invoices.purchaseOrderId,
      printedPoNumber: invoices.purchaseOrderNumber,
      linkedPoNumber: purchaseOrders.poNumber,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(invoices.organizationId, organizationId))
    .orderBy(desc(invoices.createdAt));

  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    fileName: row.fileName,
    vendor: row.vendorName,
    amount: row.totalAmount,
    currency: row.currency,
    issuedAt: row.invoiceDate,
    status: row.warnings.length > 0 ? "needs_review" : "extracted",
    extractionAccuracy:
      row.extractionConfidence === null
        ? null
        : row.extractionConfidence * PERCENT,
    indexed: Boolean(row.isIndexed),
    poMatch: toPoMatch(row.purchaseOrderId !== null, row.warnings),
    poNumber: row.linkedPoNumber ?? row.printedPoNumber,
  }));
};

/**
Every purchase order of one organization, newest first, with how many invoices are linked to it.
*/
export const listPurchaseOrders = async (
  organizationId: string
): Promise<PurchaseOrderRow[]> => {
  const db = getDb();
  const [rows, linked] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        fileName: purchaseOrders.fileName,
        vendorName: purchaseOrders.vendorName,
        totalAmount: purchaseOrders.totalAmount,
        currency: purchaseOrders.currency,
        orderDate: purchaseOrders.orderDate,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, organizationId))
      .orderBy(desc(purchaseOrders.createdAt)),
    db
      .select({
        purchaseOrderId: invoices.purchaseOrderId,
        invoiceCount: count(),
      })
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .groupBy(invoices.purchaseOrderId),
  ]);

  const invoiceCounts = new Map(
    linked.map((row) => [row.purchaseOrderId, row.invoiceCount])
  );

  return rows.map((row) => ({
    id: row.id,
    poNumber: row.poNumber,
    fileName: row.fileName,
    vendor: row.vendorName,
    amount: row.totalAmount,
    currency: row.currency,
    issuedAt: row.orderDate,
    status: null,
    source: "upload",
    matchedInvoices: invoiceCounts.get(row.id) ?? 0,
  }));
};
