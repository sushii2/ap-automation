import { differs } from "./invoice-schema.ts";
import type { PO_MATCH_METHODS, StoredLineItem } from "./db/schema.ts";

// Pure checks of invoices against the purchase order they are linked to.
// No I/O, so they are unit-tested.

// Marks a warning as produced here, so a re-check replaces only its own.
export const PO_MATCH_WARNING_PREFIX = "PO match: ";

export interface MatchedOrder {
  poNumber: string | null;
  vendorName: string | null;
  currency: string | null;
  totalAmount: number | null;
  lineItems: StoredLineItem[];
}

export interface MatchedInvoice {
  vendorName: string | null;
  currency: string | null;
  totalAmount: number | null;
  lineItems: StoredLineItem[];
  poMatchMethod: (typeof PO_MATCH_METHODS)[number] | null;
  /**
  Cosine similarity, 0–1. Only set for similarity matches.
  */
  poMatchScore: number | null;
}

const NON_ALPHANUMERIC = /[^a-z0-9]+/gu;
const COMPANY_SUFFIX =
  /^(?:co|company|corp|corporation|gmbh|inc|incorporated|limited|llc|llp|ltd|plc|pvt)$/u;
// Shorter texts are too generic to match by containment ("box" in "boxes").
const MIN_CONTAINED_LENGTH = 4;

const words = (value: string) =>
  value.toLowerCase().replaceAll(NON_ALPHANUMERIC, " ").trim().split(" ");

const companyKey = (name: string) =>
  words(name)
    .filter((word) => !COMPANY_SUFFIX.test(word))
    .join("");

const describes = (a: string, b: string) => {
  if (a === b) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_CONTAINED_LENGTH && longer.includes(shorter);
};

const sameCompany = (a: string, b: string) =>
  describes(companyKey(a), companyKey(b));

const isSameCurrency = (a: string | null, b: string | null) =>
  a === null || b === null || a.toUpperCase() === b.toUpperCase();

const exceeds = (value: number, limit: number) =>
  value > limit && differs(value, limit);

const findOrderLine = (line: StoredLineItem, orderLines: StoredLineItem[]) => {
  const description = words(line.description).join(" ");
  return orderLines.find((orderLine) => {
    const itemCode = orderLine.itemCode
      ? words(orderLine.itemCode).join(" ")
      : null;
    return (
      describes(description, words(orderLine.description).join(" ")) ||
      (itemCode !== null && describes(description, itemCode))
    );
  });
};

const lineWarnings = (
  line: StoredLineItem,
  orderLine: StoredLineItem,
  label: string
) => {
  const warnings: string[] = [];
  if (
    line.unitPrice !== null &&
    orderLine.unitPrice !== null &&
    differs(line.unitPrice, orderLine.unitPrice)
  ) {
    warnings.push(
      `${label}: unit price is ${line.unitPrice.toFixed(2)} but the order has ${orderLine.unitPrice.toFixed(2)}.`
    );
  }
  if (
    line.quantity !== null &&
    orderLine.quantity !== null &&
    line.quantity > orderLine.quantity
  ) {
    warnings.push(
      `${label}: quantity ${line.quantity} is more than the ${orderLine.quantity} ordered.`
    );
  }
  return warnings;
};

const lineItemWarnings = (invoice: MatchedInvoice, order: MatchedOrder) => {
  if (order.lineItems.length === 0) {
    return [];
  }
  const warnings: string[] = [];
  const missing: number[] = [];
  for (const [index, line] of invoice.lineItems.entries()) {
    const orderLine = findOrderLine(line, order.lineItems);
    if (orderLine) {
      warnings.push(
        ...lineWarnings(
          line,
          orderLine,
          `line ${index + 1} (${line.description})`
        )
      );
    } else {
      missing.push(index + 1);
    }
  }
  if (missing.length > 0) {
    warnings.push(
      `not on the purchase order: line ${missing.join(", ")} of the invoice.`
    );
  }
  return warnings;
};

const totalWarnings = (
  invoice: MatchedInvoice,
  order: MatchedOrder,
  billed: { total: number; count: number }
) => {
  if (order.totalAmount === null || invoice.totalAmount === null) {
    return [];
  }
  if (exceeds(invoice.totalAmount, order.totalAmount)) {
    return [
      `invoice total ${invoice.totalAmount.toFixed(2)} is more than the order total ${order.totalAmount.toFixed(2)}.`,
    ];
  }
  if (billed.count > 1 && exceeds(billed.total, order.totalAmount)) {
    return [
      `the ${billed.count} invoices on this purchase order total ${billed.total.toFixed(2)}, more than the order total ${order.totalAmount.toFixed(2)}.`,
    ];
  }
  return [];
};

const invoiceWarnings = (
  invoice: MatchedInvoice,
  order: MatchedOrder,
  billed: { total: number; count: number }
) => {
  const orderLabel = order.poNumber ?? "without a number";
  const warnings: string[] = [];
  if (invoice.poMatchMethod === "similarity") {
    warnings.push(
      `no PO number on the invoice; linked to purchase order ${orderLabel} by similarity (${(invoice.poMatchScore ?? 0).toFixed(2)}). Verify the match.`
    );
  }
  if (
    invoice.vendorName &&
    order.vendorName &&
    !sameCompany(invoice.vendorName, order.vendorName)
  ) {
    warnings.push(
      `vendor is "${invoice.vendorName}" but the order was placed with "${order.vendorName}".`
    );
  }
  if (!isSameCurrency(invoice.currency, order.currency)) {
    // Amounts in different currencies cannot be compared.
    warnings.push(
      `currency is ${invoice.currency} but the order is in ${order.currency}.`
    );
    return warnings;
  }
  warnings.push(
    ...totalWarnings(invoice, order, billed),
    ...lineItemWarnings(invoice, order)
  );
  return warnings;
};

/**
 * Checks every invoice linked to one purchase order against it: vendor, currency, totals (each invoice and all of them together) and line items.
 * Returns the warnings for each invoice, in the order given. Mismatches are flagged, not corrected.
 */
export const checkInvoicesAgainstPurchaseOrder = (
  order: MatchedOrder,
  invoices: MatchedInvoice[]
) => {
  const comparable = invoices.filter((invoice) =>
    isSameCurrency(invoice.currency, order.currency)
  );
  let total = 0;
  for (const invoice of comparable) {
    total += invoice.totalAmount ?? 0;
  }
  const billed = { total, count: comparable.length };
  return invoices.map((invoice) =>
    invoiceWarnings(invoice, order, billed).map(
      (warning) => `${PO_MATCH_WARNING_PREFIX}${warning}`
    )
  );
};

/**
Replaces an invoice's earlier PO match warnings with the current ones.
*/
export const withPurchaseOrderWarnings = (
  existing: string[],
  matchWarnings: string[]
) => [
  ...existing.filter((warning) => !warning.startsWith(PO_MATCH_WARNING_PREFIX)),
  ...matchWarnings,
];
