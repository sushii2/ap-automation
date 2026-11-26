import { metadata, schemaTask } from "@trigger.dev/sdk";

import {
  linkInvoicesToPurchaseOrder,
  savePurchaseOrder,
} from "../../lib/db/documents.ts";
import { purchaseOrderEmbeddingInput } from "../../lib/document-embedding.ts";
import { ingestPayloadSchema } from "../../lib/invoice-schema.ts";
import {
  purchaseOrderSchema,
  reconcilePurchaseOrder,
} from "../../lib/purchase-order-schema.ts";
import { embedDocument, ingestDocument } from "./ingest-document.ts";

export const ingestPurchaseOrder = schemaTask({
  id: "ingest-purchase-order",
  schema: ingestPayloadSchema,
  run: async (payload, { ctx }) => {
    const result = await ingestDocument({
      payload,
      documentType: "purchase_order",
      label: "purchase orders",
      reconcile: reconcilePurchaseOrder,
      schema: purchaseOrderSchema,
    });
    if (result.status === "rejected") {
      const { data, ...rejected } = result;
      return { ...rejected, purchaseOrder: data, record: null };
    }
    const { data: purchaseOrder, ...extracted } = result;
    const {
      organizationId,
      uploadedBy,
      fileName,
      blobPathname = null,
    } = payload;

    // 5. Embed the extracted fields.
    const embedding = await embedDocument(
      purchaseOrderEmbeddingInput(purchaseOrder, { fileName, organizationId })
    );

    // 6. Store the purchase order and its embedding.
    metadata.set("stage", "saving");
    const { warnings, ...processing } = extracted.metadata;
    const id = await savePurchaseOrder(
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
      purchaseOrder
    );

    // 7. Link invoices that arrived before this purchase order did.
    metadata.set("stage", "linking");
    const linkedInvoiceIds = await linkInvoicesToPurchaseOrder({
      organizationId,
      poNumber: purchaseOrder.poNumber,
      purchaseOrderId: id,
    });

    metadata.set("stage", "complete");
    return { ...extracted, purchaseOrder, record: { id, linkedInvoiceIds } };
  },
});
