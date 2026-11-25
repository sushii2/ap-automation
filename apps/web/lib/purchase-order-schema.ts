import { z } from "zod"

import { differs, partySchema } from "./invoice-schema.ts"

// Shared by the ingestion task and the UI. Keep this free of server-only imports.

export const purchaseOrderSchema = z.object({
  poNumber: z.string().nullable(),
  orderDate: z.string().nullable().describe("ISO 8601 date, YYYY-MM-DD."),
  deliveryDate: z
    .string()
    .nullable()
    .describe("Requested or expected delivery date, ISO 8601 YYYY-MM-DD."),
  paymentTerms: z.string().nullable().describe('As printed, e.g. "Net 30".'),
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 code, e.g. USD. Null if it cannot be determined."),
  buyer: partySchema.describe("The party issuing the purchase order."),
  vendor: partySchema.describe("The supplier the order is placed with."),
  shipTo: z
    .object({ name: z.string().nullable(), address: z.string().nullable() })
    .describe("Where the goods are delivered, if printed."),
  lineItems: z.array(
    z.object({
      itemCode: z.string().nullable().describe("SKU or part number."),
      description: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable().describe('Unit of measure, e.g. "each".'),
      unitPrice: z.number().nullable(),
      amount: z.number().nullable().describe("Line total before tax."),
    })
  ),
  subtotal: z.number().nullable().describe("Total before tax and shipping."),
  taxAmount: z.number().nullable(),
  shippingAmount: z.number().nullable(),
  totalAmount: z.number().nullable().describe("Grand total of the order."),
  confidence: z
    .number()
    .describe("Overall confidence in the extraction, from 0 to 1."),
  notes: z
    .array(z.string())
    .describe(
      "Anything a reviewer should know: ambiguous values, illegible areas, assumptions made. Empty if none."
    ),
})

export type ExtractedPurchaseOrder = z.infer<typeof purchaseOrderSchema>

/** Cross-checks the model's numbers; mismatches are flagged, not corrected. */
export function reconcilePurchaseOrder(order: ExtractedPurchaseOrder) {
  const warnings: string[] = []

  // Invoices are matched to orders line by line, so each line must add up.
  order.lineItems.forEach((item, index) => {
    if (
      item.quantity !== null &&
      item.unitPrice !== null &&
      item.amount !== null &&
      differs(item.quantity * item.unitPrice, item.amount)
    ) {
      warnings.push(
        `Line ${index + 1}: quantity times unit price does not equal the amount.`
      )
    }
  })

  const lineAmounts = order.lineItems.map((item) => item.amount)
  if (
    order.subtotal !== null &&
    lineAmounts.length > 0 &&
    lineAmounts.every((amount) => amount !== null)
  ) {
    const sum = lineAmounts.reduce((total, amount) => total + amount, 0)
    if (differs(sum, order.subtotal)) {
      warnings.push(
        `Line items sum to ${sum.toFixed(2)} but subtotal is ${order.subtotal.toFixed(2)}.`
      )
    }
  }

  // Tax and shipping are often absent on an order; absent means zero here.
  if (
    order.subtotal !== null &&
    order.totalAmount !== null &&
    differs(
      order.subtotal + (order.taxAmount ?? 0) + (order.shippingAmount ?? 0),
      order.totalAmount
    )
  ) {
    warnings.push(
      "Subtotal plus tax and shipping does not equal the total amount."
    )
  }

  if (!order.poNumber) warnings.push("PO number is missing.")
  if (order.totalAmount === null) warnings.push("Total amount is missing.")

  return warnings
}
