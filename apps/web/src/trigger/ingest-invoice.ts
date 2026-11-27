import { metadata, schemaTask } from "@trigger.dev/sdk";

import {
  linkInvoiceToPurchaseOrder,
  saveInvoice,
} from "../../lib/db/documents.ts";
import { invoiceEmbeddingInput } from "../../lib/document-embedding.ts";
import {
  ingestPayloadSchema,
  invoiceSchema,
  reconcile,
} from "../../lib/invoice-schema.ts";
import { embedDocument, ingestDocument } from "./ingest-document.ts";

export const ingestInvoice = schemaTask({
  id: "ingest-invoice",
  schema: ingestPayloadSchema,
  run: async (payload, { ctx }) => {
    const result = await ingestDocument({
      payload,
      reconcile,
      documentType: "invoice",
      label: "invoices",
      schema: invoiceSchema,
    });
    if (result.status === "rejected") {
      const { data, ...rejected } = result;
      return { ...rejected, invoice: data, record: null };
    }
    const { data: invoice, ...extracted } = result;
    const {
      organizationId,
      uploadedBy,
      fileName,
      blobPathname = null,
    } = payload;

    // 5. Embed the extracted fields.
    const embedding = await embedDocument(
      invoiceEmbeddingInput(invoice, { fileName, organizationId })
    );

    // 6. Store the invoice and its embedding.
    metadata.set("stage", "saving");
    const { warnings: reconciled, ...processing } = extracted.metadata;
    const id = await saveInvoice(
      {
        blobPathname,
        embedding,
        fileName,
        organizationId,
        uploadedBy,
        warnings: reconciled,
        processing: {
          ...processing,
          classification: extracted.classification,
          embeddingUsage: embedding.usage,
        },
        runId: ctx.run.id,
      },
      invoice
    );

    // 7. Link the purchase order this invoice bills against, if we hold it,
    // and check the invoice against it. This follows the save so that a
    // purchase order ingested at the same moment cannot miss the invoice.
    metadata.set("stage", "linking");
    const { purchaseOrder, warnings: matchWarnings } =
      await linkInvoiceToPurchaseOrder({
        organizationId,
        embedding: embedding.vector,
        invoiceId: id,
        purchaseOrderNumber: invoice.purchaseOrderNumber,
      });
    const warnings = [...reconciled, ...matchWarnings];

    metadata.set("stage", "complete");
    return {
      ...extracted,
      invoice,
      metadata: { ...extracted.metadata, warnings },
      record: { id, purchaseOrder },
    };
  },
});
