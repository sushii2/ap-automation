import {
  FieldEncryptor,
  LocalKeyProvider,
  blindIndex,
} from "@workspace/crypto";
import { and, cosineDistance, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { normalizePoNumber, toIsoDate } from "../document-embedding.ts";
import { getDb } from "./client.ts";
import { invoices, purchaseOrders } from "./schema.ts";
import type { EmbeddingInput } from "../document-embedding.ts";
import type { ExtractedInvoice } from "../invoice-schema.ts";
import type { ExtractedPurchaseOrder } from "../purchase-order-schema.ts";
import type { PO_MATCH_METHODS, StoredParty } from "./schema.ts";

// Persistence for ingested documents. Called from Trigger.dev tasks, so this
// must not import server-only modules (lib/env.ts, lib/encryption.ts).

// An invoice with no PO number is linked to the nearest purchase order only
// when the two embeddings are at least this similar (cosine, 0–1).
export const MIN_PO_SIMILARITY = 0.85;

interface Party extends StoredParty {
  taxId: string | null;
}

/**
What every saved document carries besides its extracted fields.
*/
export interface DocumentRecord {
  /**
  Trigger.dev run ID; a retried run overwrites its own row.
  */
  runId: string;
  organizationId: string;
  uploadedBy: string;
  fileName: string;
  blobPathname: string | null;
  warnings: string[];
  processing: Record<string, unknown>;
  embedding: { vector: number[]; model: string } & EmbeddingInput;
}

export interface PurchaseOrderMatch {
  purchaseOrderId: string;
  poNumber: string | null;
  method: (typeof PO_MATCH_METHODS)[number];
  /**
  Cosine similarity; null for an exact PO number match.
  */
  score: number | null;
}

const cache: { encryptor?: FieldEncryptor } = {};

const getEncryptor = () => {
  if ((process.env.ENCRYPTION_PROVIDER ?? "local") !== "local") {
    throw new Error("KMS key provider not configured yet");
  }
  cache.encryptor ??= new FieldEncryptor(LocalKeyProvider.fromEnv());
  return cache.encryptor;
};

/**
Encrypts a tax ID for one column of one row, with a blind index for lookups.
*/
const sealTaxId = async (
  taxId: string | null,
  context: { tenantId: string; table: string; column: string; id: string }
) => {
  if (!taxId) {
    return { ciphertext: null, index: null };
  }
  const key = process.env.BLIND_INDEX_KEY;
  if (!key) {
    throw new Error("BLIND_INDEX_KEY is not set.");
  }
  return {
    ciphertext: await getEncryptor().encrypt(taxId, context),
    index: blindIndex(taxId, key, context.tenantId),
  };
};

const withoutTaxId = ({ name, address, email }: Party): StoredParty => ({
  name,
  address,
  email,
});

/**
Columns shared by both document tables.
*/
const documentValues = (
  record: DocumentRecord,
  extraction: { confidence: number; notes: string[] }
) => ({
  organizationId: record.organizationId,
  uploadedBy: record.uploadedBy,
  fileName: record.fileName,
  blobPathname: record.blobPathname,
  ingestionRunId: record.runId,
  warnings: record.warnings,
  processing: record.processing,
  extractionConfidence: extraction.confidence,
  notes: extraction.notes,
  embedding: record.embedding.vector,
  embeddingModel: record.embedding.model,
  embeddingContent: record.embedding.content,
  embeddingMetadata: record.embedding.metadata,
});

/**
 * Finds the purchase order an invoice belongs to, within one organization.
 * A printed PO number is matched exactly (ignoring case and punctuation). An
 * invoice without one falls back to the most similar purchase order, if any is similar enough.
 */
export const findPurchaseOrderForInvoice = async ({
  organizationId,
  purchaseOrderNumber,
  embedding,
}: {
  organizationId: string;
  purchaseOrderNumber: string | null;
  embedding: number[];
}): Promise<PurchaseOrderMatch | null> => {
  const db = getDb();
  const normalized = normalizePoNumber(purchaseOrderNumber);

  if (normalized) {
    // The invoice names its PO. If we don't hold it yet, don't guess another:
    // the link is made when that PO is ingested.
    const [order] = await db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, organizationId),
          eq(purchaseOrders.poNumberNormalized, normalized)
        )
      )
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(1);
    return order
      ? {
          purchaseOrderId: order.id,
          poNumber: order.poNumber,
          method: "po_number",
          score: null,
        }
      : null;
  }

  const distance = cosineDistance(purchaseOrders.embedding, embedding);
  const [nearest] = await db
    .select({
      distance,
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
    })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.organizationId, organizationId),
        isNotNull(purchaseOrders.embedding)
      )
    )
    .orderBy(distance)
    .limit(1);
  if (!nearest) {
    return null;
  }
  const score = 1 - Number(nearest.distance);
  return score >= MIN_PO_SIMILARITY
    ? {
        score,
        purchaseOrderId: nearest.id,
        poNumber: nearest.poNumber,
        method: "similarity",
      }
    : null;
};

export const saveInvoice = async (
  record: DocumentRecord,
  invoice: ExtractedInvoice,
  match: PurchaseOrderMatch | null
) => {
  const db = getDb();
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.ingestionRunId, record.runId));
  // The row ID is bound into the tax ID ciphertexts, so a retry must reuse it.
  const id = existing?.id ?? crypto.randomUUID();
  const context = { id, table: "invoices", tenantId: record.organizationId };
  const [vendorTaxId, customerTaxId] = await Promise.all([
    sealTaxId(invoice.vendor.taxId, { ...context, column: "vendor_tax_id" }),
    sealTaxId(invoice.customer.taxId, {
      ...context,
      column: "customer_tax_id",
    }),
  ]);

  const values = {
    ...documentValues(record, invoice),
    paymentTerms: invoice.paymentTerms,
    currency: invoice.currency,
    vendorName: invoice.vendor.name,
    vendor: withoutTaxId(invoice.vendor),
    vendorTaxId: vendorTaxId.ciphertext,
    vendorTaxIdIndex: vendorTaxId.index,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: toIsoDate(invoice.invoiceDate),
    dueDate: toIsoDate(invoice.dueDate),
    customerName: invoice.customer.name,
    customer: withoutTaxId(invoice.customer),
    customerTaxId: customerTaxId.ciphertext,
    customerTaxIdIndex: customerTaxId.index,
    amountDue: invoice.amountDue,
    purchaseOrderNumber: invoice.purchaseOrderNumber,
    purchaseOrderNumberNormalized: normalizePoNumber(
      invoice.purchaseOrderNumber
    ),
    purchaseOrderId: match?.purchaseOrderId ?? null,
    poMatchMethod: match?.method ?? null,
    poMatchScore: match?.score ?? null,
  };

  await db
    .insert(invoices)
    .values({ id, ...values })
    .onConflictDoUpdate({ target: invoices.id, set: values });
  return id;
};

export const savePurchaseOrder = async (
  record: DocumentRecord,
  order: ExtractedPurchaseOrder
) => {
  const db = getDb();
  const [existing] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.ingestionRunId, record.runId));
  // The row ID is bound into the tax ID ciphertexts, so a retry must reuse it.
  const id = existing?.id ?? crypto.randomUUID();
  const context = {
    id,
    table: "purchase_orders",
    tenantId: record.organizationId,
  };
  const [vendorTaxId, buyerTaxId] = await Promise.all([
    sealTaxId(order.vendor.taxId, { ...context, column: "vendor_tax_id" }),
    sealTaxId(order.buyer.taxId, { ...context, column: "buyer_tax_id" }),
  ]);

  const values = {
    ...documentValues(record, order),
    paymentTerms: order.paymentTerms,
    currency: order.currency,
    vendorName: order.vendor.name,
    vendor: withoutTaxId(order.vendor),
    vendorTaxId: vendorTaxId.ciphertext,
    vendorTaxIdIndex: vendorTaxId.index,
    lineItems: order.lineItems,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    totalAmount: order.totalAmount,
    poNumber: order.poNumber,
    poNumberNormalized: normalizePoNumber(order.poNumber),
    orderDate: toIsoDate(order.orderDate),
    deliveryDate: toIsoDate(order.deliveryDate),
    buyerName: order.buyer.name,
    buyer: withoutTaxId(order.buyer),
    buyerTaxId: buyerTaxId.ciphertext,
    buyerTaxIdIndex: buyerTaxId.index,
    shipTo: order.shipTo,
    shippingAmount: order.shippingAmount,
  };

  await db
    .insert(purchaseOrders)
    .values({ id, ...values })
    .onConflictDoUpdate({ target: purchaseOrders.id, set: values });
  return id;
};

/**
 * Links invoices that arrived before their purchase order: every invoice in the organization that prints this PO number and has no purchase order yet.
 * Returns the linked invoice IDs.
 */
export const linkInvoicesToPurchaseOrder = async ({
  organizationId,
  purchaseOrderId,
  poNumber,
}: {
  organizationId: string;
  purchaseOrderId: string;
  poNumber: string | null;
}) => {
  const normalized = normalizePoNumber(poNumber);
  if (!normalized) {
    return [];
  }
  const linked = await getDb()
    .update(invoices)
    .set({ purchaseOrderId, poMatchMethod: "po_number", poMatchScore: null })
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.purchaseOrderNumberNormalized, normalized),
        isNull(invoices.purchaseOrderId)
      )
    )
    .returning({ id: invoices.id });
  return linked.map((invoice) => invoice.id);
};
