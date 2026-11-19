CREATE SCHEMA "sales";
--> statement-breakpoint
CREATE TABLE "sales"."delivery_note_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"delivery_note_id" uuid NOT NULL,
	"sales_order_item_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint,
	"serial_numbers" jsonb,
	"remarks" text,
	"stock_movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "delivery_note_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."delivery_notes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
	"status" text DEFAULT 'prepared' NOT NULL,
	"delivery_date" date NOT NULL,
	"project_name" text,
	"project_location" text,
	"recipient_name" text NOT NULL,
	"recipient_address" text,
	"recipient_pic" varchar(200),
	"recipient_contact" varchar(200),
	"driver_name" varchar(200),
	"vehicle_number" varchar(32),
	"notes" text,
	"shipped_at" bigint,
	"shipped_by" text,
	"received_at" bigint,
	"receiver_name" text,
	"cancelled_at" bigint,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "delivery_notes_status_check" CHECK ("status" IN ('prepared', 'shipped', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sales"."invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"item_id" uuid,
	"item_variant_id" uuid,
	"description" text,
	"quantity" numeric(18,4) DEFAULT '0' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "invoice_items_quantity_check" CHECK (quantity >= 0),
	CONSTRAINT "invoice_items_unit_price_check" CHECK (unit_price >= 0),
	CONSTRAINT "invoice_items_discount_check" CHECK (discount_amount >= 0),
	CONSTRAINT "invoice_items_tax_check" CHECK (tax_amount >= 0),
	CONSTRAINT "invoice_items_line_total_check" CHECK (line_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32),
	"invoice_type" text DEFAULT 'sales' NOT NULL,
	"term_kind" text,
	"customer_id" uuid,
	"customer_snapshot" jsonb,
	"sales_order_id" uuid,
	"sales_order_code" varchar(32),
	"quotation_code" varchar(40),
	"title" text,
	"description" text,
	"percentage_bps" integer,
	"payment_term_id" uuid,
	"issue_date" date,
	"due_date" date,
	"vat_enabled" boolean DEFAULT true NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"paid_total" bigint DEFAULT 0 NOT NULL,
	"outstanding_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"terms" text,
	"notes" text,
	"created_by" text,
	"issued_by" text,
	"issued_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"voided_by" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "invoices_type_check" CHECK (invoice_type IN ('sales', 'proforma', 'recurring')),
	CONSTRAINT "invoices_term_kind_check" CHECK (term_kind IS NULL OR term_kind IN ('down_payment', 'installment', 'settlement')),
	CONSTRAINT "invoices_status_check" CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void', 'cancelled')),
	CONSTRAINT "invoices_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000),
	CONSTRAINT "invoices_subtotal_check" CHECK (subtotal >= 0),
	CONSTRAINT "invoices_discount_total_check" CHECK (discount_total >= 0),
	CONSTRAINT "invoices_tax_total_check" CHECK (tax_total >= 0),
	CONSTRAINT "invoices_grand_total_check" CHECK (grand_total >= 0),
	CONSTRAINT "invoices_paid_total_check" CHECK (paid_total >= 0 AND paid_total <= grand_total),
	CONSTRAINT "invoices_outstanding_total_check" CHECK (outstanding_total >= 0),
	CONSTRAINT "invoices_due_after_issue_check" CHECK (due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date)
);
--> statement-breakpoint
CREATE TABLE "sales"."order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"sales_order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" bigint NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sales"."payments" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"quotation_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"executed_by" text,
	"executed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales"."quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"quotation_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"image_object_key" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "quotation_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0 AND "line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."quotation_status_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"quotation_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" bigint NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sales"."quotations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40) NOT NULL,
	"base_code" varchar(32) NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"previous_revision_id" uuid,
	"title" text NOT NULL,
	"heading" varchar(120),
	"customer_id" uuid NOT NULL,
	"customer_contact_id" uuid,
	"customer_snapshot" jsonb NOT NULL,
	"lead_id" uuid,
	"attention" varchar(200),
	"status" text DEFAULT 'draft' NOT NULL,
	"quotation_date" date NOT NULL,
	"valid_until" date,
	"payment_terms" varchar(300),
	"payment_schedule" jsonb,
	"guarantee" varchar(300),
	"vat_enabled" boolean DEFAULT true NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"notes" text,
	"terms" text,
	"created_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"rejected_reason" text,
	"sent_by" text,
	"sent_at" bigint,
	"closed_by" text,
	"closed_at" bigint,
	"lost_reason" text,
	"lost_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "quotations_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'rejected', 'sent', 'superseded', 'won', 'lost')),
	CONSTRAINT "quotations_lost_reason_check" CHECK ("lost_reason" IS NULL OR "lost_reason" IN ('price', 'competitor', 'project_cancelled', 'no_response', 'other')),
	CONSTRAINT "quotations_revision_check" CHECK ("revision" >= 0),
	CONSTRAINT "quotations_vat_rate_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000),
	CONSTRAINT "quotations_amounts_check" CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "grand_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"payment_id" uuid,
	"received_date" date,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"received_by" text,
	"posted_at" bigint,
	"reversed_by" text,
	"reversed_at" bigint,
	"reversal_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "receipts_status_check" CHECK (status IN ('draft', 'verified', 'posted', 'reversed', 'void')),
	CONSTRAINT "receipts_amount_check" CHECK (amount > 0),
	CONSTRAINT "receipts_method_check" CHECK (method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'))
);
--> statement-breakpoint
CREATE TABLE "sales"."sales_order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"sales_order_id" uuid NOT NULL,
	"quotation_item_id" uuid,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"quantity_delivered" numeric(18,3) DEFAULT '0' NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "sales_order_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0 AND "line_total" >= 0 AND "quantity_delivered" >= 0),
	CONSTRAINT "sales_order_items_fulfillment_status_check" CHECK ("fulfillment_status" IN ('pending', 'reserved', 'partial', 'fulfilled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sales"."sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"quotation_id" uuid NOT NULL,
	"quotation_code" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"customer_po_number" varchar(100),
	"title" text NOT NULL,
	"attention" varchar(200),
	"status" text DEFAULT 'confirmed' NOT NULL,
	"order_date" date NOT NULL,
	"delivery_date" date,
	"payment_terms" varchar(300),
	"payment_schedule" jsonb,
	"guarantee" varchar(300),
	"vat_enabled" boolean NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"sales_person_user_id" text,
	"notes" text,
	"created_by" text,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancellation_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "sales_orders_status_check" CHECK ("status" IN ('confirmed', 'in_progress', 'delivered', 'completed', 'cancelled')),
	CONSTRAINT "sales_orders_vat_rate_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000),
	CONSTRAINT "sales_orders_amounts_check" CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "grand_total" >= 0)
);
--> statement-breakpoint
CREATE INDEX "delivery_note_items_delivery_note_id_idx" ON "sales"."delivery_note_items" ("delivery_note_id");--> statement-breakpoint
CREATE INDEX "delivery_note_items_sales_order_item_id_idx" ON "sales"."delivery_note_items" ("sales_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_notes_code_uq" ON "sales"."delivery_notes" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "delivery_notes_sales_order_id_idx" ON "sales"."delivery_notes" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_status_idx" ON "sales"."delivery_notes" ("status");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "sales"."invoice_items" ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_item_id_idx" ON "sales"."invoice_items" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_code_uq" ON "sales"."invoices" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "sales"."invoices" ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_sales_order_id_idx" ON "sales"."invoices" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "sales"."invoices" ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "sales"."invoices" ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_term_kind_idx" ON "sales"."invoices" ("term_kind");--> statement-breakpoint
CREATE INDEX "order_status_history_sales_order_id_idx" ON "sales"."order_status_history" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "sales"."payments" ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_quotation_idx" ON "sales"."payments" ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_sort_idx" ON "sales"."quotation_items" ("quotation_id","sort_order");--> statement-breakpoint
CREATE INDEX "quotation_status_history_quotation_id_idx" ON "sales"."quotation_status_history" ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_code_uq" ON "sales"."quotations" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "quotations_base_code_idx" ON "sales"."quotations" ("base_code");--> statement-breakpoint
CREATE INDEX "quotations_customer_id_idx" ON "sales"."quotations" ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "sales"."quotations" ("status");--> statement-breakpoint
CREATE INDEX "quotations_created_by_idx" ON "sales"."quotations" ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_code_uq" ON "sales"."receipts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "receipts_sales_invoice_id_idx" ON "sales"."receipts" ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_payment_id_idx" ON "sales"."receipts" ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_status_idx" ON "sales"."receipts" ("status");--> statement-breakpoint
CREATE INDEX "sales_order_items_order_sort_idx" ON "sales"."sales_order_items" ("sales_order_id","sort_order");--> statement-breakpoint
CREATE INDEX "sales_order_items_fulfillment_status_idx" ON "sales"."sales_order_items" ("fulfillment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_code_uq" ON "sales"."sales_orders" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_live_quotation_uq" ON "sales"."sales_orders" ("quotation_id") WHERE deleted_at IS NULL AND status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "sales_orders_quotation_id_idx" ON "sales"."sales_orders" ("quotation_id");--> statement-breakpoint
CREATE INDEX "sales_orders_customer_id_idx" ON "sales"."sales_orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales"."sales_orders" ("status");--> statement-breakpoint
CREATE INDEX "sales_orders_sales_person_idx" ON "sales"."sales_orders" ("sales_person_user_id");--> statement-breakpoint
ALTER TABLE "sales"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_delivery_notes_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "sales"."delivery_notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_GizTnQCLjA1F_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales"."sales_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."delivery_notes" ADD CONSTRAINT "delivery_notes_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."order_status_history" ADD CONSTRAINT "order_status_history_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_previous_revision_id_quotations_id_fkey" FOREIGN KEY ("previous_revision_id") REFERENCES "sales"."quotations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."sales_order_items" ADD CONSTRAINT "sales_order_items_quotation_item_id_quotation_items_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "sales"."quotation_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE RESTRICT;

--> statement-breakpoint
-- Hand-written: sales.receipts.sales_invoice_id is a same-module reference the
-- schema models as a plain id, but it carries a real FK today (added by
-- 20261109090000). Preserved so a fresh database keeps the constraint.
--
-- The companion FK this migration used to carry,
-- receipts_payment_id_payments_id_fkey, is deliberately NOT recreated: it points
-- from sales.receipts to finance.payments, and cross-schema foreign keys are
-- forbidden (elysia-module rule 3.2, ADR-0014). payment_id stays a plain id
-- validated through the Finance contract.
ALTER TABLE "sales"."receipts" ADD CONSTRAINT "receipts_sales_invoice_id_invoices_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

