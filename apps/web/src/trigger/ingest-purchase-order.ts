import { schemaTask } from "@trigger.dev/sdk";

import { ingestPayloadSchema } from "../../lib/invoice-schema.ts";
import {
  purchaseOrderSchema,
  reconcilePurchaseOrder,
} from "../../lib/purchase-order-schema.ts";
import { ingestDocument } from "./ingest-document.ts";

export const ingestPurchaseOrder = schemaTask({
  id: "ingest-purchase-order",
  schema: ingestPayloadSchema,
  run: async (payload) => {
    const { data, ...result } = await ingestDocument({
      payload,
      documentType: "purchase_order",
      label: "purchase orders",
      schema: purchaseOrderSchema,
      reconcile: reconcilePurchaseOrder,
    });
    return { ...result, purchaseOrder: data };
  },
});
