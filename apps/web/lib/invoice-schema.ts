import { z } from "zod"

// Shared by the ingestion task and the UI. Keep this free of server-only imports.

export const DOCUMENT_TYPES = [
  "invoice",
  "credit_note",
  "purchase_order",
  "receipt",
  "statement",
  "quote",
  "remittance_advice",
  "other",
] as const

export const classificationSchema = z.object({
  documentType: z
    .enum(DOCUMENT_TYPES)
    .describe("The single best-fitting type for this document."),
  confidence: z
    .number()
    .describe("Confidence in documentType, from 0 (guess) to 1 (certain)."),
  reasoning: z
    .string()
    .describe("One or two sentences citing the evidence in the document."),
})

const partySchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  taxId: z.string().nullable().describe("VAT, GST, EIN or similar tax ID."),
  email: z.string().nullable(),
})

export const invoiceSchema = z.object({
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable().describe("ISO 8601 date, YYYY-MM-DD."),
  dueDate: z.string().nullable().describe("ISO 8601 date, YYYY-MM-DD."),
  purchaseOrderNumber: z.string().nullable(),
  paymentTerms: z.string().nullable().describe('As printed, e.g. "Net 30".'),
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 code, e.g. USD. Null if it cannot be determined."),
  vendor: partySchema.describe("The party issuing the invoice."),
  customer: partySchema.describe("The party being billed."),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unitPrice: z.number().nullable(),
      amount: z.number().nullable().describe("Line total before tax."),
    })
  ),
  subtotal: z.number().nullable().describe("Total before tax."),
  taxAmount: z.number().nullable(),
  totalAmount: z.number().nullable().describe("Grand total including tax."),
  amountDue: z.number().nullable().describe("Balance still owed."),
  confidence: z
    .number()
    .describe("Overall confidence in the extraction, from 0 to 1."),
  notes: z
    .array(z.string())
    .describe(
      "Anything a reviewer should know: ambiguous values, illegible areas, assumptions made. Empty if none."
    ),
})

export type InvoiceClassification = z.infer<typeof classificationSchema>
export type ExtractedInvoice = z.infer<typeof invoiceSchema>

export const ingestPayloadSchema = z
  .object({
    fileName: z.string().min(1),
    /** A URL the task can fetch the document from, e.g. a presigned URL. */
    fileUrl: z.url().optional(),
    /** A `reducto://` ID, when the caller already uploaded the file. */
    reductoFileId: z.string().startsWith("reducto://").optional(),
  })
  .refine(
    (payload) => Boolean(payload.fileUrl) !== Boolean(payload.reductoFileId),
    { message: "Provide exactly one of fileUrl or reductoFileId" }
  )

/** Cross-checks the model's numbers; mismatches are flagged, not corrected. */
export function reconcile(invoice: ExtractedInvoice) {
  const warnings: string[] = []
  const differs = (a: number, b: number) => Math.abs(a - b) > 0.01

  const lineAmounts = invoice.lineItems.map((item) => item.amount)
  if (
    invoice.subtotal !== null &&
    lineAmounts.length > 0 &&
    lineAmounts.every((amount) => amount !== null)
  ) {
    const sum = lineAmounts.reduce((total, amount) => total + amount, 0)
    if (differs(sum, invoice.subtotal)) {
      warnings.push(
        `Line items sum to ${sum.toFixed(2)} but subtotal is ${invoice.subtotal.toFixed(2)}.`
      )
    }
  }

  if (
    invoice.subtotal !== null &&
    invoice.taxAmount !== null &&
    invoice.totalAmount !== null &&
    differs(invoice.subtotal + invoice.taxAmount, invoice.totalAmount)
  ) {
    warnings.push("Subtotal plus tax does not equal the total amount.")
  }

  if (!invoice.invoiceNumber) warnings.push("Invoice number is missing.")
  if (invoice.totalAmount === null) warnings.push("Total amount is missing.")

  return warnings
}
