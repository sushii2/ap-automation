/**
 * Placeholder rows so the invoice and purchase-order tables have something to sort and filter. Replace with real queries once the data layer exists.
 */

export type InvoiceStatus =
  "processing" | "extracted" | "needs_review" | "failed";
export type PoMatch = "matched" | "partial" | "unmatched";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  amount: number;
  issuedAt: string;
  status: InvoiceStatus;
  /**
  0–100, null while extraction has not finished.
  */
  extractionAccuracy: number | null;
  indexed: boolean;
  poMatch: PoMatch;
  poNumber: string | null;
}

export type PurchaseOrderStatus =
  "open" | "partially_received" | "closed" | "cancelled";
export type PurchaseOrderSource = "upload" | "manual";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  amount: number;
  issuedAt: string;
  status: PurchaseOrderStatus;
  source: PurchaseOrderSource;
  matchedInvoices: number;
}

export const PLACEHOLDER_INVOICES: Invoice[] = [
  {
    id: "inv_01",
    invoiceNumber: "INV-2041",
    vendor: "Northwind Supply Co.",
    amount: 12_480.5,
    issuedAt: "2026-11-18",
    status: "extracted",
    extractionAccuracy: 98.4,
    indexed: true,
    poMatch: "matched",
    poNumber: "PO-7731",
  },
  {
    id: "inv_02",
    invoiceNumber: "INV-2040",
    vendor: "Halden Logistics",
    amount: 3120,
    issuedAt: "2026-11-17",
    status: "extracted",
    extractionAccuracy: 96.1,
    indexed: true,
    poMatch: "matched",
    poNumber: "PO-7729",
  },
  {
    id: "inv_03",
    invoiceNumber: "INV-2039",
    vendor: "Brightline Software",
    amount: 899,
    issuedAt: "2026-11-15",
    status: "needs_review",
    extractionAccuracy: 71.8,
    indexed: true,
    poMatch: "unmatched",
    poNumber: null,
  },
  {
    id: "inv_04",
    invoiceNumber: "INV-2038",
    vendor: "Kestrel Packaging",
    amount: 5640.75,
    issuedAt: "2026-11-14",
    status: "extracted",
    extractionAccuracy: 93.2,
    indexed: false,
    poMatch: "partial",
    poNumber: "PO-7718",
  },
  {
    id: "inv_05",
    invoiceNumber: "INV-2037",
    vendor: "Northwind Supply Co.",
    amount: 2210,
    issuedAt: "2026-11-12",
    status: "processing",
    extractionAccuracy: null,
    indexed: false,
    poMatch: "unmatched",
    poNumber: null,
  },
  {
    id: "inv_06",
    invoiceNumber: "INV-2036",
    vendor: "Orchard Facilities",
    amount: 780.4,
    issuedAt: "2026-11-10",
    status: "failed",
    extractionAccuracy: null,
    indexed: false,
    poMatch: "unmatched",
    poNumber: null,
  },
  {
    id: "inv_07",
    invoiceNumber: "INV-2035",
    vendor: "Halden Logistics",
    amount: 4415,
    issuedAt: "2026-11-07",
    status: "extracted",
    extractionAccuracy: 99.1,
    indexed: true,
    poMatch: "matched",
    poNumber: "PO-7702",
  },
  {
    id: "inv_08",
    invoiceNumber: "INV-2034",
    vendor: "Meridian Print Works",
    amount: 1365.2,
    issuedAt: "2026-11-05",
    status: "needs_review",
    extractionAccuracy: 64.5,
    indexed: true,
    poMatch: "partial",
    poNumber: "PO-7698",
  },
  {
    id: "inv_09",
    invoiceNumber: "INV-2033",
    vendor: "Brightline Software",
    amount: 899,
    issuedAt: "2026-10-15",
    status: "extracted",
    extractionAccuracy: 97.7,
    indexed: true,
    poMatch: "matched",
    poNumber: "PO-7655",
  },
  {
    id: "inv_10",
    invoiceNumber: "INV-2032",
    vendor: "Kestrel Packaging",
    amount: 9120,
    issuedAt: "2026-10-09",
    status: "extracted",
    extractionAccuracy: 88.9,
    indexed: true,
    poMatch: "unmatched",
    poNumber: null,
  },
  {
    id: "inv_11",
    invoiceNumber: "INV-2031",
    vendor: "Orchard Facilities",
    amount: 1540,
    issuedAt: "2026-10-03",
    status: "extracted",
    extractionAccuracy: 95.3,
    indexed: true,
    poMatch: "matched",
    poNumber: "PO-7640",
  },
  {
    id: "inv_12",
    invoiceNumber: "INV-2030",
    vendor: "Meridian Print Works",
    amount: 420.9,
    issuedAt: "2026-09-28",
    status: "extracted",
    extractionAccuracy: 91.6,
    indexed: false,
    poMatch: "unmatched",
    poNumber: null,
  },
];

export const PLACEHOLDER_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po_01",
    poNumber: "PO-7731",
    vendor: "Northwind Supply Co.",
    amount: 12_480.5,
    issuedAt: "2026-11-02",
    status: "closed",
    source: "upload",
    matchedInvoices: 1,
  },
  {
    id: "po_02",
    poNumber: "PO-7729",
    vendor: "Halden Logistics",
    amount: 3120,
    issuedAt: "2026-11-01",
    status: "closed",
    source: "manual",
    matchedInvoices: 1,
  },
  {
    id: "po_03",
    poNumber: "PO-7725",
    vendor: "Brightline Software",
    amount: 10_788,
    issuedAt: "2026-10-28",
    status: "open",
    source: "manual",
    matchedInvoices: 0,
  },
  {
    id: "po_04",
    poNumber: "PO-7718",
    vendor: "Kestrel Packaging",
    amount: 11_200,
    issuedAt: "2026-10-24",
    status: "partially_received",
    source: "upload",
    matchedInvoices: 1,
  },
  {
    id: "po_05",
    poNumber: "PO-7702",
    vendor: "Halden Logistics",
    amount: 4415,
    issuedAt: "2026-10-20",
    status: "closed",
    source: "upload",
    matchedInvoices: 1,
  },
  {
    id: "po_06",
    poNumber: "PO-7698",
    vendor: "Meridian Print Works",
    amount: 2730.4,
    issuedAt: "2026-10-18",
    status: "partially_received",
    source: "manual",
    matchedInvoices: 1,
  },
  {
    id: "po_07",
    poNumber: "PO-7671",
    vendor: "Orchard Facilities",
    amount: 6400,
    issuedAt: "2026-10-06",
    status: "cancelled",
    source: "manual",
    matchedInvoices: 0,
  },
  {
    id: "po_08",
    poNumber: "PO-7655",
    vendor: "Brightline Software",
    amount: 899,
    issuedAt: "2026-09-30",
    status: "closed",
    source: "upload",
    matchedInvoices: 1,
  },
  {
    id: "po_09",
    poNumber: "PO-7640",
    vendor: "Orchard Facilities",
    amount: 1540,
    issuedAt: "2026-09-22",
    status: "closed",
    source: "upload",
    matchedInvoices: 1,
  },
];
