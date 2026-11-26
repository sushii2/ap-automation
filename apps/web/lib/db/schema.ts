/* eslint-disable unicorn/no-top-level-side-effects -- a Drizzle schema is declared by calling its builders at module level */
import {
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import type { EmbeddingMetadata } from "../document-embedding.ts";

// Must match the output size of EMBEDDING_MODEL in lib/document-embedding.ts.
export const EMBEDDING_DIMENSIONS = 1536;

/**
A party as stored: the tax ID lives in its own encrypted column.
*/
export interface StoredParty {
  name: string | null;
  address: string | null;
  email: string | null;
}

export interface StoredLineItem {
  itemCode?: string | null;
  description: string;
  quantity: number | null;
  unit?: string | null;
  unitPrice: number | null;
  amount: number | null;
}

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const amount = (name: string) =>
  numeric(name, { precision: 18, scale: 2, mode: "number" });

// Organizations and users mirror WorkOS, which stays the source of truth.
// IDs are the WorkOS IDs (`org_…`, `user_…`).
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  ...timestamps(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_memberships_user_idx").on(table.userId),
  ]
);

/**
Columns every ingested document has, whatever its type.
*/
const documentColumns = () => ({
  id: uuid("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),

  paymentTerms: text("payment_terms"),
  currency: text("currency"),
  vendorName: text("vendor_name"),
  vendor: jsonb("vendor").$type<StoredParty>().notNull(),
  // Tax IDs are envelope-encrypted; the blind index allows exact-match lookups.
  vendorTaxId: text("vendor_tax_id"),
  vendorTaxIdIndex: text("vendor_tax_id_index"),
  lineItems: jsonb("line_items").$type<StoredLineItem[]>().notNull(),
  subtotal: amount("subtotal"),
  taxAmount: amount("tax_amount"),
  totalAmount: amount("total_amount"),

  extractionConfidence: real("extraction_confidence"),
  notes: jsonb("notes").$type<string[]>().notNull(),
  warnings: jsonb("warnings").$type<string[]>().notNull(),
  // Classification, source file, model and token usage of the ingestion run.
  processing: jsonb("processing").$type<Record<string, unknown>>().notNull(),
  fileName: text("file_name").notNull(),
  blobPathname: text("blob_pathname"),
  // One row per Trigger.dev run, so a retried run updates instead of duplicating.
  ingestionRunId: text("ingestion_run_id").notNull().unique(),

  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  embeddingModel: text("embedding_model"),
  embeddingContent: text("embedding_content"),
  embeddingMetadata: jsonb("embedding_metadata").$type<EmbeddingMetadata>(),

  ...timestamps(),
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    ...documentColumns(),
    poNumber: text("po_number"),
    // Upper-cased alphanumerics only, so "PO-7731" matches "po 7731".
    poNumberNormalized: text("po_number_normalized"),
    orderDate: date("order_date"),
    deliveryDate: date("delivery_date"),
    buyerName: text("buyer_name"),
    buyer: jsonb("buyer").$type<StoredParty>().notNull(),
    buyerTaxId: text("buyer_tax_id"),
    buyerTaxIdIndex: text("buyer_tax_id_index"),
    shipTo: jsonb("ship_to")
      .$type<{ name: string | null; address: string | null }>()
      .notNull(),
    shippingAmount: amount("shipping_amount"),
  },
  (table) => [
    index("purchase_orders_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("purchase_orders_org_po_number_idx").on(
      table.organizationId,
      table.poNumberNormalized
    ),
    index("purchase_orders_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const PO_MATCH_METHODS = ["po_number", "similarity"] as const;

export const invoices = pgTable(
  "invoices",
  {
    ...documentColumns(),
    invoiceNumber: text("invoice_number"),
    invoiceDate: date("invoice_date"),
    dueDate: date("due_date"),
    customerName: text("customer_name"),
    customer: jsonb("customer").$type<StoredParty>().notNull(),
    customerTaxId: text("customer_tax_id"),
    customerTaxIdIndex: text("customer_tax_id_index"),
    amountDue: amount("amount_due"),

    // The PO number as printed on the invoice, whether or not we hold that PO.
    purchaseOrderNumber: text("purchase_order_number"),
    purchaseOrderNumberNormalized: text("purchase_order_number_normalized"),
    // The linked purchase order, once one is found.
    purchaseOrderId: uuid("purchase_order_id").references(
      () => purchaseOrders.id,
      { onDelete: "set null" }
    ),
    poMatchMethod: text("po_match_method", { enum: PO_MATCH_METHODS }),
    // Cosine similarity, 0–1. Only set for similarity matches.
    poMatchScore: real("po_match_score"),
  },
  (table) => [
    index("invoices_org_created_idx").on(table.organizationId, table.createdAt),
    index("invoices_org_po_number_idx").on(
      table.organizationId,
      table.purchaseOrderNumberNormalized
    ),
    index("invoices_purchase_order_idx").on(table.purchaseOrderId),
    index("invoices_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);
