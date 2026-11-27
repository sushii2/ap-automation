import {
  FieldEncryptor,
  LocalKeyProvider,
  blindIndex,
} from "@workspace/crypto";
import {
  and,
  cosineDistance,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { normalizePoNumber, toIsoDate } from "../document-embedding.ts";
import {
  checkInvoicesAgainstPurchaseOrder,
  withPurchaseOrderWarnings,
} from "../po-matching.ts";
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

/**
 * Stores an invoice without touching its purchase order link, which
 * `linkInvoiceToPurchaseOrder` makes once the row exists.
 */
export const saveInvoice = async (
  record: DocumentRecord,
  invoice: ExtractedInvoice
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
 * Re-checks every invoice linked to a purchase order against it and stores the outcome in each invoice's warnings, replacing the earlier outcome.
 * Returns the PO match warnings by invoice ID.
 */
export const refreshPurchaseOrderChecks = async ({
  organizationId,
  purchaseOrderId,
}: {
  organizationId: string;
  purchaseOrderId: string;
}) => {
  const db = getDb();
  const matchWarnings = new Map<string, string[]>();
  const [order] = await db
    .select({
      currency: purchaseOrders.currency,
      lineItems: purchaseOrders.lineItems,
      poNumber: purchaseOrders.poNumber,
      totalAmount: purchaseOrders.totalAmount,
      vendorName: purchaseOrders.vendorName,
    })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.organizationId, organizationId),
        eq(purchaseOrders.id, purchaseOrderId)
      )
    );
  if (!order) {
    return matchWarnings;
  }
  const linked = await db
    .select({
      currency: invoices.currency,
      id: invoices.id,
      lineItems: invoices.lineItems,
      poMatchMethod: invoices.poMatchMethod,
      poMatchScore: invoices.poMatchScore,
      totalAmount: invoices.totalAmount,
      vendorName: invoices.vendorName,
      warnings: invoices.warnings,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.purchaseOrderId, purchaseOrderId)
      )
    );

  const checks = checkInvoicesAgainstPurchaseOrder(order, linked);
  await Promise.all(
    linked.map(async (invoice, index) => {
      const warnings = checks[index] ?? [];
      matchWarnings.set(invoice.id, warnings);
      await db
        .update(invoices)
        .set({
          warnings: withPurchaseOrderWarnings(invoice.warnings, warnings),
        })
        .where(eq(invoices.id, invoice.id));
    })
  );
  return matchWarnings;
};

/**
 * Links a saved invoice to the purchase order it bills against, if we hold it, and checks the two against each other.
 * Runs after the invoice is saved: a purchase order ingested at the same moment then either finds this invoice or is found here.
 */
export const linkInvoiceToPurchaseOrder = async ({
  invoiceId,
  organizationId,
  purchaseOrderNumber,
  embedding,
}: {
  invoiceId: string;
  organizationId: string;
  purchaseOrderNumber: string | null;
  embedding: number[];
}) => {
  const purchaseOrder = await findPurchaseOrderForInvoice({
    embedding,
    organizationId,
    purchaseOrderNumber,
  });
  if (!purchaseOrder) {
    return { purchaseOrder: null, warnings: [] };
  }
  await getDb()
    .update(invoices)
    .set({
      poMatchMethod: purchaseOrder.method,
      poMatchScore: purchaseOrder.score,
      purchaseOrderId: purchaseOrder.purchaseOrderId,
    })
    .where(eq(invoices.id, invoiceId));
  const matchWarnings = await refreshPurchaseOrderChecks({
    organizationId,
    purchaseOrderId: purchaseOrder.purchaseOrderId,
  });
  return { purchaseOrder, warnings: matchWarnings.get(invoiceId) ?? [] };
};

interface MovedInvoice {
  id: string;
  previousPurchaseOrderId: string | null;
}

/**
 * Links every invoice that prints this PO number to the purchase order, including invoices linked to an earlier upload of the same number.
 * Only the newest purchase order with a number takes its invoices, which is also the one a new invoice is linked to.
 */
const linkInvoicesByPoNumber = async ({
  organizationId,
  purchaseOrderId,
  poNumber,
}: {
  organizationId: string;
  purchaseOrderId: string;
  poNumber: string | null;
}): Promise<MovedInvoice[]> => {
  const normalized = normalizePoNumber(poNumber);
  if (!normalized) {
    return [];
  }
  const db = getDb();
  const [newest] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.organizationId, organizationId),
        eq(purchaseOrders.poNumberNormalized, normalized)
      )
    )
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(1);
  if (newest?.id !== purchaseOrderId) {
    return [];
  }
  const moved = await db
    .select({
      id: invoices.id,
      previousPurchaseOrderId: invoices.purchaseOrderId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.purchaseOrderNumberNormalized, normalized),
        or(
          isNull(invoices.purchaseOrderId),
          ne(invoices.purchaseOrderId, purchaseOrderId)
        )
      )
    );
  if (moved.length > 0) {
    await db
      .update(invoices)
      .set({ purchaseOrderId, poMatchMethod: "po_number", poMatchScore: null })
      .where(
        inArray(
          invoices.id,
          moved.map((invoice) => invoice.id)
        )
      );
  }
  return moved;
};

/**
 * Links invoices that print no PO number and are similar enough to the purchase order: those with no purchase order yet, and those linked to another one by a weaker similarity.
 */
const linkInvoicesBySimilarity = async ({
  organizationId,
  purchaseOrderId,
  embedding,
}: {
  organizationId: string;
  purchaseOrderId: string;
  embedding: number[];
}): Promise<MovedInvoice[]> => {
  const db = getDb();
  const score = sql<number>`1 - (${cosineDistance(invoices.embedding, embedding)})`;
  const moved = await db
    .select({
      score,
      id: invoices.id,
      previousPurchaseOrderId: invoices.purchaseOrderId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        isNull(invoices.purchaseOrderNumberNormalized),
        isNotNull(invoices.embedding),
        gte(score, MIN_PO_SIMILARITY),
        or(
          isNull(invoices.purchaseOrderId),
          and(
            eq(invoices.poMatchMethod, "similarity"),
            ne(invoices.purchaseOrderId, purchaseOrderId),
            lt(invoices.poMatchScore, score)
          )
        )
      )
    );
  await Promise.all(
    moved.map((invoice) =>
      db
        .update(invoices)
        .set({
          purchaseOrderId,
          poMatchMethod: "similarity",
          poMatchScore: Number(invoice.score),
        })
        .where(eq(invoices.id, invoice.id))
    )
  );
  return moved;
};

/**
 * Links the invoices that belong to a purchase order which arrived after them, by PO number and by similarity, then checks them against it.
 * Purchase orders that lost an invoice to this one are re-checked too. Returns the linked invoice IDs.
 */
export const linkInvoicesToPurchaseOrder = async ({
  organizationId,
  purchaseOrderId,
  poNumber,
  embedding,
}: {
  organizationId: string;
  purchaseOrderId: string;
  poNumber: string | null;
  embedding: number[];
}) => {
  // An invoice either prints a PO number or does not, so the two never overlap.
  const [byPoNumber, bySimilarity] = await Promise.all([
    linkInvoicesByPoNumber({ organizationId, poNumber, purchaseOrderId }),
    linkInvoicesBySimilarity({ embedding, organizationId, purchaseOrderId }),
  ]);
  const moved = [...byPoNumber, ...bySimilarity];

  const affected = new Set([purchaseOrderId]);
  for (const invoice of moved) {
    if (invoice.previousPurchaseOrderId) {
      affected.add(invoice.previousPurchaseOrderId);
    }
  }
  await Promise.all(
    [...affected].map((id) =>
      refreshPurchaseOrderChecks({ organizationId, purchaseOrderId: id })
    )
  );
  return moved.map((invoice) => invoice.id);
};
