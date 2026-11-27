import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PO_MATCH_WARNING_PREFIX,
  checkInvoicesAgainstPurchaseOrder,
  withPurchaseOrderWarnings,
} from "./po-matching.ts";
import type { MatchedInvoice, MatchedOrder } from "./po-matching.ts";

const boxes = {
  itemCode: "SKU-1",
  description: "Boxes",
  quantity: 10,
  unit: "each",
  unitPrice: 4,
  amount: 40,
};

const order: MatchedOrder = {
  poNumber: "PO-1",
  vendorName: "Acme Supplies Ltd",
  currency: "USD",
  totalAmount: 50,
  lineItems: [boxes],
};

const invoice = (overrides: Partial<MatchedInvoice> = {}): MatchedInvoice => ({
  vendorName: "ACME Supplies Limited",
  currency: "usd",
  totalAmount: 50,
  lineItems: [{ description: "Boxes", quantity: 10, unitPrice: 4, amount: 40 }],
  poMatchMethod: "po_number",
  poMatchScore: null,
  ...overrides,
});

const check = (invoices: MatchedInvoice[]) =>
  checkInvoicesAgainstPurchaseOrder(order, invoices);

test("an invoice that agrees with its order has no warnings", () => {
  assert.deepEqual(check([invoice()]), [[]]);
});

test("every warning carries the PO match prefix", () => {
  const [warnings] = check([invoice({ vendorName: "Globex" })]);
  assert.equal(warnings?.length, 1);
  assert.ok(warnings?.[0]?.startsWith(PO_MATCH_WARNING_PREFIX));
});

test("a different vendor is flagged", () => {
  const [warnings] = check([invoice({ vendorName: "Globex Inc" })]);
  assert.match(warnings?.[0] ?? "", /vendor is "Globex Inc"/u);
});

test("a different currency is flagged and amounts are not compared", () => {
  const [warnings] = check([invoice({ currency: "EUR", totalAmount: 900 })]);
  assert.equal(warnings?.length, 1);
  assert.match(warnings?.[0] ?? "", /currency is EUR/u);
});

test("an invoice over the order total is flagged", () => {
  const [warnings] = check([invoice({ totalAmount: 60 })]);
  assert.match(warnings?.[0] ?? "", /invoice total 60\.00 is more than/u);
});

test("invoices that together exceed the order total are all flagged", () => {
  const checks = check([
    invoice({ totalAmount: 30 }),
    invoice({ totalAmount: 30 }),
  ]);
  for (const warnings of checks) {
    assert.match(warnings[0] ?? "", /2 invoices .* total 60\.00/u);
  }
});

test("partial invoices within the order total are not flagged", () => {
  const partial = invoice({
    totalAmount: 25,
    lineItems: [
      { description: "Boxes", quantity: 5, unitPrice: 4, amount: 20 },
    ],
  });
  assert.deepEqual(check([partial, partial]), [[], []]);
});

test("a changed unit price and an over-billed quantity are flagged", () => {
  const [warnings] = check([
    invoice({
      lineItems: [
        { description: "boxes", quantity: 12, unitPrice: 4.5, amount: 54 },
      ],
      totalAmount: null,
    }),
  ]);
  assert.equal(warnings?.length, 2);
  assert.match(warnings?.[0] ?? "", /unit price is 4\.50 .* 4\.00/u);
  assert.match(warnings?.[1] ?? "", /quantity 12 is more than the 10/u);
});

test("an invoice line is matched by the order's item code", () => {
  const [warnings] = check([
    invoice({
      lineItems: [
        { description: "SKU-1 cartons", quantity: 1, unitPrice: 4, amount: 4 },
      ],
    }),
  ]);
  assert.deepEqual(warnings, []);
});

test("lines that are not on the order are listed", () => {
  const [warnings] = check([
    invoice({
      lineItems: [
        { description: "Boxes", quantity: 1, unitPrice: 4, amount: 4 },
        { description: "Rush fee", quantity: 1, unitPrice: 9, amount: 9 },
      ],
    }),
  ]);
  assert.equal(warnings?.length, 1);
  assert.match(warnings?.[0] ?? "", /not on the purchase order: line 2/u);
});

test("a similarity match asks for verification", () => {
  const [warnings] = check([
    invoice({ poMatchMethod: "similarity", poMatchScore: 0.912 }),
  ]);
  assert.match(warnings?.[0] ?? "", /by similarity \(0\.91\)\. Verify/u);
});

test("a re-check replaces earlier PO match warnings and keeps the rest", () => {
  const existing = [
    "Invoice number is missing.",
    `${PO_MATCH_WARNING_PREFIX}stale.`,
  ];
  assert.deepEqual(
    withPurchaseOrderWarnings(existing, [`${PO_MATCH_WARNING_PREFIX}new.`]),
    ["Invoice number is missing.", `${PO_MATCH_WARNING_PREFIX}new.`]
  );
});
