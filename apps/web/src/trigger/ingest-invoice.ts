import { schemaTask } from "@trigger.dev/sdk"

import {
  ingestPayloadSchema,
  invoiceSchema,
  reconcile,
} from "../../lib/invoice-schema.ts"
import { ingestDocument } from "./ingest-document.ts"

export const ingestInvoice = schemaTask({
  id: "ingest-invoice",
  schema: ingestPayloadSchema,
  run: async (payload) => {
    const { data, ...result } = await ingestDocument({
      payload,
      documentType: "invoice",
      label: "invoices",
      schema: invoiceSchema,
      reconcile,
    })
    return { ...result, invoice: data }
  },
})
