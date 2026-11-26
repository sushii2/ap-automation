import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ingestPayloadSchema,
  invoiceSchema,
  reconcile,
} from "./invoice-schema.ts";
import type { ExtractedInvoice } from "./invoice-schema.ts";

const party = { name: null, address: null, taxId: null, email: null };

function invoice(overrides: Partial<ExtractedInvoice> = {}): ExtractedInvoice {
  return {
    invoiceNumber: "INV-1",
    invoiceDate: "2026-01-25",
    dueDate: null,
    purchaseOrderNumber: null,
    paymentTerms: null,
    currency: "USD",
    vendor: party,
    customer: party,
    lineItems: [
      { description: "Design", quantity: 1, unitPrice: 85, amount: 85 },
    ],
    subtotal: 85,
    taxAmount: 8.5,
    totalAmount: 93.5,
    amountDue: 93.5,
    confidence: 0.9,
    notes: [],
    ...overrides,
  };
}

test("a consistent invoice has no warnings", () => {
  assert.deepEqual(reconcile(invoice()), []);
});

test("flags line items that do not sum to the subtotal", () => {
  const [warning, ...rest] = reconcile(
    invoice({ subtotal: 80, taxAmount: 13.5 })
  );
  assert.match(warning ?? "", /sum to 85\.00 but subtotal is 80\.00/);
  assert.deepEqual(rest, []);
});

test("flags subtotal plus tax that does not equal the total", () => {
  assert.deepEqual(reconcile(invoice({ totalAmount: 100 })), [
    "Subtotal plus tax does not equal the total amount.",
  ]);
});

test("tolerates floating point drift", () => {
  const lineItems = [
    { description: "a", quantity: 1, unitPrice: 0.1, amount: 0.1 },
    { description: "b", quantity: 1, unitPrice: 0.2, amount: 0.2 },
  ];
  assert.deepEqual(
    reconcile(
      invoice({ lineItems, subtotal: 0.3, taxAmount: 0, totalAmount: 0.3 })
    ),
    []
  );
});

test("skips checks whose inputs are missing instead of guessing", () => {
  const lineItems = [
    { description: "a", quantity: null, unitPrice: null, amount: null },
  ];
  assert.deepEqual(reconcile(invoice({ lineItems, taxAmount: null })), []);
  assert.deepEqual(reconcile(invoice({ lineItems: [] })), []);
});

test("flags a missing invoice number and total", () => {
  assert.deepEqual(
    reconcile(invoice({ invoiceNumber: "", totalAmount: null })),
    ["Invoice number is missing.", "Total amount is missing."]
  );
});

test("payload needs exactly one document source", () => {
  const fileName = "a.pdf";
  const fileUrl = "https://example.com/a.pdf";
  const reductoFileId = "reducto://abc.pdf";
  const ok = (payload: unknown) =>
    ingestPayloadSchema.safeParse(payload).success;

  assert.ok(ok({ fileName, fileUrl }));
  assert.ok(ok({ fileName, reductoFileId }));
  assert.ok(!ok({ fileName }));
  assert.ok(!ok({ fileName, fileUrl, reductoFileId }));
});

test("payload rejects malformed sources and empty names", () => {
  const ok = (payload: unknown) =>
    ingestPayloadSchema.safeParse(payload).success;

  assert.ok(!ok({ fileName: "a.pdf", fileUrl: "not a url" }));
  // A plain URL must not be smuggled in as an already-uploaded Reducto file.
  assert.ok(
    !ok({ fileName: "a.pdf", reductoFileId: "https://example.com/a.pdf" })
  );
  assert.ok(!ok({ fileName: "", fileUrl: "https://example.com/a.pdf" }));
});

test("invoice schema accepts nulls but not omitted or mistyped fields", () => {
  assert.ok(invoiceSchema.safeParse(invoice()).success);

  const { currency: _currency, ...withoutCurrency } = invoice();
  assert.ok(!invoiceSchema.safeParse(withoutCurrency).success);
  assert.ok(
    !invoiceSchema.safeParse({ ...invoice(), totalAmount: "93.50" }).success
  );
});
