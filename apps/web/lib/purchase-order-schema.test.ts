import assert from "node:assert/strict"
import { test } from "node:test"

import {
  purchaseOrderSchema,
  reconcilePurchaseOrder,
  type ExtractedPurchaseOrder,
} from "./purchase-order-schema.ts"

const party = { name: null, address: null, taxId: null, email: null }
const line = {
  itemCode: "SKU-1",
  description: "Boxes",
  quantity: 10,
  unit: "each",
  unitPrice: 4,
  amount: 40,
}

function order(
  overrides: Partial<ExtractedPurchaseOrder> = {}
): ExtractedPurchaseOrder {
  return {
    poNumber: "PO-1",
    orderDate: "2026-11-02",
    deliveryDate: null,
    paymentTerms: null,
    currency: "USD",
    buyer: party,
    vendor: party,
    shipTo: { name: null, address: null },
    lineItems: [line],
    subtotal: 40,
    taxAmount: 4,
    shippingAmount: 6,
    totalAmount: 50,
    confidence: 0.9,
    notes: [],
    ...overrides,
  }
}

test("a consistent order has no warnings", () => {
  assert.deepEqual(reconcilePurchaseOrder(order()), [])
})

test("treats absent tax and shipping as zero", () => {
  assert.deepEqual(
    reconcilePurchaseOrder(
      order({ taxAmount: null, shippingAmount: null, totalAmount: 40 })
    ),
    []
  )
})

test("flags a line whose quantity times unit price is not its amount", () => {
  const lineItems = [line, { ...line, quantity: 3, amount: 40 }]
  assert.deepEqual(
    reconcilePurchaseOrder(order({ lineItems, subtotal: 80, totalAmount: 90 })),
    ["Line 2: quantity times unit price does not equal the amount."]
  )
})

test("flags line items that do not sum to the subtotal", () => {
  const [warning] = reconcilePurchaseOrder(
    order({ subtotal: 45, totalAmount: 55 })
  )
  assert.match(warning ?? "", /sum to 40\.00 but subtotal is 45\.00/)
})

test("flags a total that leaves out shipping", () => {
  assert.deepEqual(reconcilePurchaseOrder(order({ totalAmount: 44 })), [
    "Subtotal plus tax and shipping does not equal the total amount.",
  ])
})

test("skips line checks whose inputs are missing", () => {
  const lineItems = [{ ...line, quantity: null, amount: null }]
  assert.deepEqual(reconcilePurchaseOrder(order({ lineItems })), [])
})

test("flags a missing PO number and total", () => {
  assert.deepEqual(
    reconcilePurchaseOrder(order({ poNumber: null, totalAmount: null })),
    ["PO number is missing.", "Total amount is missing."]
  )
})

test("schema accepts nulls but not omitted or mistyped fields", () => {
  assert.ok(purchaseOrderSchema.safeParse(order()).success)

  const { shipTo: _shipTo, ...withoutShipTo } = order()
  assert.ok(!purchaseOrderSchema.safeParse(withoutShipTo).success)
  assert.ok(
    !purchaseOrderSchema.safeParse({ ...order(), totalAmount: "50" }).success
  )
})
