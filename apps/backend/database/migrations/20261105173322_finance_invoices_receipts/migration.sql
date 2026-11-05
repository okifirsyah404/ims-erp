CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TABLE "finance"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32),
	"invoice_type" text DEFAULT 'sales' NOT NULL,
	"term_kind" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_code" varchar(32) NOT NULL,
	"quotation_code" varchar(40) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"percentage_bps" integer,
	"issue_date" date,
	"due_date" date,
	"vat_enabled" boolean NOT NULL,
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
	"voided_by" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "invoices_type_check" CHECK ("invoice_type" IN ('sales')),
	CONSTRAINT "invoices_term_kind_check" CHECK ("term_kind" IN ('down_payment', 'installment', 'settlement')),
	CONSTRAINT "invoices_status_check" CHECK ("status" IN ('draft', 'issued', 'partially_paid', 'paid', 'void')),
	CONSTRAINT "invoices_vat_rate_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000),
	CONSTRAINT "invoices_amounts_check" CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "grand_total" > 0 AND "paid_total" >= 0 AND "paid_total" <= "grand_total" AND "outstanding_total" >= 0),
	CONSTRAINT "invoices_dates_check" CHECK ("due_date" IS NULL OR "issue_date" IS NULL OR "due_date" >= "issue_date")
);
--> statement-breakpoint
CREATE TABLE "finance"."receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"invoice_id" uuid NOT NULL,
	"received_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"received_by" text,
	"reversed_by" text,
	"reversed_at" bigint,
	"reversal_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "receipts_status_check" CHECK ("status" IN ('posted', 'reversed')),
	CONSTRAINT "receipts_amount_check" CHECK ("amount" > 0),
	CONSTRAINT "receipts_method_check" CHECK ("method" IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_code_uq" ON "finance"."invoices" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "finance"."invoices" ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_sales_order_id_idx" ON "finance"."invoices" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "finance"."invoices" ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "finance"."invoices" ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_term_kind_idx" ON "finance"."invoices" ("term_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_code_uq" ON "finance"."receipts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "receipts_invoice_id_idx" ON "finance"."receipts" ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_status_idx" ON "finance"."receipts" ("status");--> statement-breakpoint
ALTER TABLE "finance"."receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "finance"."invoices"("id") ON DELETE RESTRICT;