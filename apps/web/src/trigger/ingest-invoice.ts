import { metadata, schemaTask } from "@trigger.dev/sdk";

import {
  findPurchaseOrderForInvoice,
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

    // 6. Link the purchase order this invoice bills against, if we hold it.
    metadata.set("stage", "linking");
    const purchaseOrder = await findPurchaseOrderForInvoice({
      organizationId,
      embedding: embedding.vector,
      purchaseOrderNumber: invoice.purchaseOrderNumber,
    });
    const warnings = [...extracted.metadata.warnings];
    if (purchaseOrder?.method === "similarity") {
      warnings.push(
        `No PO number on the invoice; linked to purchase order ${purchaseOrder.poNumber ?? purchaseOrder.purchaseOrderId} by similarity (${purchaseOrder.score?.toFixed(2)}). Verify the match.`
      );
    }

    // 7. Store the invoice, its embedding and the link.
    metadata.set("stage", "saving");
    const { warnings: _reconciled, ...processing } = extracted.metadata;
    const id = await saveInvoice(
      {
        blobPathname,
        embedding,
        fileName,
        organizationId,
        uploadedBy,
        warnings,
        processing: {
          ...processing,
          classification: extracted.classification,
          embeddingUsage: embedding.usage,
        },
        runId: ctx.run.id,
      },
      invoice,
      purchaseOrder
    );

    metadata.set("stage", "complete");
    return {
      ...extracted,
      invoice,
      metadata: { ...extracted.metadata, warnings },
      record: { id, purchaseOrder },
    };
  },
});
