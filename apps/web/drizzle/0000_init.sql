CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"uploaded_by" text,
	"payment_terms" text,
	"currency" text,
	"vendor_name" text,
	"vendor" jsonb NOT NULL,
	"vendor_tax_id" text,
	"vendor_tax_id_index" text,
	"line_items" jsonb NOT NULL,
	"subtotal" numeric(18, 2),
	"tax_amount" numeric(18, 2),
	"total_amount" numeric(18, 2),
	"extraction_confidence" real,
	"notes" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"processing" jsonb NOT NULL,
	"file_name" text NOT NULL,
	"blob_pathname" text,
	"ingestion_run_id" text NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_content" text,
	"embedding_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invoice_number" text,
	"invoice_date" date,
	"due_date" date,
	"customer_name" text,
	"customer" jsonb NOT NULL,
	"customer_tax_id" text,
	"customer_tax_id_index" text,
	"amount_due" numeric(18, 2),
	"purchase_order_number" text,
	"purchase_order_number_normalized" text,
	"purchase_order_id" uuid,
	"po_match_method" text,
	"po_match_score" real,
	CONSTRAINT "invoices_ingestion_run_id_unique" UNIQUE("ingestion_run_id")
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"uploaded_by" text,
	"payment_terms" text,
	"currency" text,
	"vendor_name" text,
	"vendor" jsonb NOT NULL,
	"vendor_tax_id" text,
	"vendor_tax_id_index" text,
	"line_items" jsonb NOT NULL,
	"subtotal" numeric(18, 2),
	"tax_amount" numeric(18, 2),
	"total_amount" numeric(18, 2),
	"extraction_confidence" real,
	"notes" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"processing" jsonb NOT NULL,
	"file_name" text NOT NULL,
	"blob_pathname" text,
	"ingestion_run_id" text NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_content" text,
	"embedding_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"po_number" text,
	"po_number_normalized" text,
	"order_date" date,
	"delivery_date" date,
	"buyer_name" text,
	"buyer" jsonb NOT NULL,
	"buyer_tax_id" text,
	"buyer_tax_id_index" text,
	"ship_to" jsonb NOT NULL,
	"shipping_amount" numeric(18, 2),
	CONSTRAINT "purchase_orders_ingestion_run_id_unique" UNIQUE("ingestion_run_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_org_created_idx" ON "invoices" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_org_po_number_idx" ON "invoices" USING btree ("organization_id","purchase_order_number_normalized");--> statement-breakpoint
CREATE INDEX "invoices_purchase_order_idx" ON "invoices" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "invoices_embedding_idx" ON "invoices" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_org_created_idx" ON "purchase_orders" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "purchase_orders_org_po_number_idx" ON "purchase_orders" USING btree ("organization_id","po_number_normalized");--> statement-breakpoint
CREATE INDEX "purchase_orders_embedding_idx" ON "purchase_orders" USING hnsw ("embedding" vector_cosine_ops);