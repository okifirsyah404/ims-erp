-- Merge main into merge/main-sync: Sales owns invoice + receipt (ADR-0011
-- step 5a / PR #67 decisions). finance.invoices + finance.invoice_items are
-- dropped; sales.invoices gains the full terms model from the finance side;
-- sales.receipts replaces finance.receipts (main's statuses, HEAD's extras).
-- Append-only: existing rows are never edited in place, tables are dropped
-- with their data only because the finance invoice slice was never released.

-- sales.invoices: full terms model -------------------------------------------------
ALTER TABLE "sales"."invoices" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "term_kind" text;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "customer_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "sales_order_code" varchar(32);--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "quotation_code" varchar(40);--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "percentage_bps" integer;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "vat_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "vat_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "terms" text;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD COLUMN "voided_by" text;--> statement-breakpoint
ALTER TABLE "sales"."invoices" DROP CONSTRAINT "invoices_status_check";--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_status_check" CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void', 'cancelled'));--> statement-breakpoint
ALTER TABLE "sales"."invoices" DROP CONSTRAINT "invoices_paid_total_check";--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_paid_total_check" CHECK (paid_total >= 0 AND paid_total <= grand_total);--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_term_kind_check" CHECK (term_kind IS NULL OR term_kind IN ('down_payment', 'installment', 'settlement'));--> statement-breakpoint
ALTER TABLE "sales"."invoices" ADD CONSTRAINT "invoices_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000);--> statement-breakpoint
CREATE INDEX "invoices_term_kind_idx" ON "sales"."invoices" ("term_kind");--> statement-breakpoint

-- sales.receipts (moved from finance.receipts; sales_invoice_id now NOT NULL) ------
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
);--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_code_uq" ON "sales"."receipts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "receipts_sales_invoice_id_idx" ON "sales"."receipts" ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_payment_id_idx" ON "sales"."receipts" ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_status_idx" ON "sales"."receipts" ("status");--> statement-breakpoint
ALTER TABLE "sales"."receipts" ADD CONSTRAINT "receipts_sales_invoice_id_invoices_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id") ON DELETE SET NULL;--> statement-breakpoint

-- finance invoice slice is retired (Sales owns AR documents now) -------------------
DROP TABLE IF EXISTS "finance"."receipts";--> statement-breakpoint
DROP TABLE IF EXISTS "finance"."invoice_items";--> statement-breakpoint
DROP TABLE IF EXISTS "finance"."invoices";
