import assert from "node:assert/strict";
import { test } from "node:test";

import {
  invoiceEmbeddingInput,
  normalizePoNumber,
  purchaseOrderEmbeddingInput,
  toIsoDate,
} from "./document-embedding.ts";
import type { ExtractedInvoice } from "./invoice-schema.ts";
import type { ExtractedPurchaseOrder } from "./purchase-order-schema.ts";

const context = { fileName: "a.pdf", organizationId: "org_1" };
const vendor = {
  address: "1 Dock Road",
  email: "billing@northwind.example",
  name: "Northwind Supply Co.",
  taxId: "12-3456789",
};
const buyer = { address: null, email: null, name: "Acme Inc.", taxId: null };

const invoice: ExtractedInvoice = {
  vendor,
  amountDue: 44,
  confidence: 0.9,
  currency: "USD",
  customer: buyer,
  dueDate: "2026-12-01",
  invoiceDate: "2026-11-01",
  invoiceNumber: "INV-1",
  lineItems: [{ amount: 40, description: "Boxes", quantity: 10, unitPrice: 4 }],
  notes: [],
  paymentTerms: "Net 30",
  purchaseOrderNumber: "PO-7731",
  subtotal: 40,
  taxAmount: 4,
  totalAmount: 44,
};

const order: ExtractedPurchaseOrder = {
  buyer,
  vendor,
  confidence: 0.9,
  currency: "USD",
  deliveryDate: null,
  lineItems: [
    {
      amount: 40,
      description: "Boxes",
      itemCode: "SKU-1",
      quantity: 10,
      unit: "each",
      unitPrice: 4,
    },
  ],
  notes: [],
  orderDate: "2026-10-20",
  paymentTerms: null,
  poNumber: "PO-7731",
  shipTo: { address: null, name: null },
  shippingAmount: null,
  subtotal: 40,
  taxAmount: 4,
  totalAmount: 44,
};

test("PO numbers compare equal across case and punctuation", () => {
  assert.equal(normalizePoNumber("PO-7731"), "PO7731");
  assert.equal(normalizePoNumber(" po 7731 "), "PO7731");
  assert.equal(normalizePoNumber("PO/7731"), "PO7731");
  assert.equal(normalizePoNumber("---"), null);
  assert.equal(normalizePoNumber(""), null);
  assert.equal(normalizePoNumber(null), null);
});

test("only real ISO dates are kept", () => {
  assert.equal(toIsoDate("2026-11-01"), "2026-11-01");
  assert.equal(toIsoDate("2026-02-30"), null);
  assert.equal(toIsoDate("11/01/2026"), null);
  assert.equal(toIsoDate("2026-11-01T00:00:00Z"), null);
  assert.equal(toIsoDate(null), null);
});

test("invoice content describes the document and skips missing fields", () => {
  const { content } = invoiceEmbeddingInput(
    { ...invoice, dueDate: null },
    context
  );

  assert.ok(content.startsWith("Invoice\nInvoice number: INV-1"));
  assert.ok(content.includes("Purchase order number: PO-7731"));
  assert.ok(content.includes("Vendor: Northwind Supply Co."));
  assert.ok(content.includes("- Boxes (qty: 10, unit price: 4, amount: 40)"));
  assert.ok(!content.includes("Due date"));
});

test("embedded content never contains tax IDs or emails", () => {
  for (const { content } of [
    invoiceEmbeddingInput(invoice, context),
    purchaseOrderEmbeddingInput(order, context),
  ]) {
    assert.ok(!content.includes(vendor.taxId));
    assert.ok(!content.includes(vendor.email));
  }
});

test("a document without line items has no line item section", () => {
  const { content, metadata } = invoiceEmbeddingInput(
    { ...invoice, lineItems: [] },
    context
  );

  assert.ok(!content.includes("Line items"));
  assert.equal(metadata.lineItemCount, 0);
});

test("metadata identifies the document", () => {
  assert.deepEqual(invoiceEmbeddingInput(invoice, context).metadata, {
    counterpartyName: "Acme Inc.",
    currency: "USD",
    documentDate: "2026-11-01",
    documentNumber: "INV-1",
    documentType: "invoice",
    fileName: "a.pdf",
    lineItemCount: 1,
    organizationId: "org_1",
    purchaseOrderNumber: "PO-7731",
    totalAmount: 44,
    vendorName: "Northwind Supply Co.",
  });

  const { content, metadata } = purchaseOrderEmbeddingInput(order, context);
  assert.equal(metadata.documentType, "purchase_order");
  assert.equal(metadata.documentNumber, "PO-7731");
  assert.ok(content.includes("- SKU-1 Boxes (qty: 10"));
});
