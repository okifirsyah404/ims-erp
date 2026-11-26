CREATE TABLE "finance"."credit_memos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid,
	"memo_date" date,
	"amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"journal_entry_id" uuid,
	"created_by" text,
	"issued_by" text,
	"issued_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "credit_memos_currency_idr_check" CHECK (currency_code = 'IDR'),
	CONSTRAINT "credit_memos_status_check" CHECK (status IN ('draft', 'issued', 'applied', 'void')),
	CONSTRAINT "credit_memos_amount_check" CHECK (amount > 0),
	CONSTRAINT "credit_memos_tax_check" CHECK (tax_amount >= 0 AND tax_amount <= amount)
);
--> statement-breakpoint
CREATE TABLE "finance"."deferred_revenue_schedules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"invoice_id" uuid,
	"invoice_item_id" uuid,
	"issue_entry_id" uuid,
	"discriminator_type" text DEFAULT '' NOT NULL,
	"discriminator_value" text DEFAULT '' NOT NULL,
	"total_amount" bigint NOT NULL,
	"recognized_amount" bigint DEFAULT 0 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"recognized_through" varchar(7),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "deferred_revenue_schedules_status_check" CHECK (status IN ('active', 'completed', 'cancelled')),
	CONSTRAINT "deferred_revenue_schedules_total_check" CHECK (total_amount > 0),
	CONSTRAINT "deferred_revenue_schedules_recognized_check" CHECK (recognized_amount >= 0 AND recognized_amount <= total_amount),
	CONSTRAINT "deferred_revenue_schedules_range_check" CHECK (end_date >= start_date)
);
--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "adjusted_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "write_off_reason" text;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "write_off_requested_by" text;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "write_off_requested_at" bigint;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "written_off_by" text;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "written_off_at" bigint;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD COLUMN "write_off_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "sale"."invoice_items" ADD COLUMN "service_period_start" date;--> statement-breakpoint
ALTER TABLE "sale"."invoice_items" ADD COLUMN "service_period_end" date;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_memos_org_code_uq" ON "finance"."credit_memos" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "credit_memos_invoice_id_idx" ON "finance"."credit_memos" ("invoice_id");--> statement-breakpoint
CREATE INDEX "credit_memos_status_idx" ON "finance"."credit_memos" ("status");--> statement-breakpoint
CREATE INDEX "deferred_revenue_schedules_invoice_id_idx" ON "finance"."deferred_revenue_schedules" ("invoice_id");--> statement-breakpoint
CREATE INDEX "deferred_revenue_schedules_status_idx" ON "finance"."deferred_revenue_schedules" ("status");--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD CONSTRAINT "ar_open_items_write_off_entry_id_journal_entries_id_fkey" FOREIGN KEY ("write_off_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."credit_memos" ADD CONSTRAINT "credit_memos_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."deferred_revenue_schedules" ADD CONSTRAINT "deferred_revenue_schedules_siL5e2WU5Nxp_fkey" FOREIGN KEY ("issue_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD CONSTRAINT "ar_open_items_adjusted_check" CHECK (adjusted_amount >= 0);--> statement-breakpoint
ALTER TABLE "sale"."invoice_items" ADD CONSTRAINT "invoice_items_service_period_pair_check" CHECK ((service_period_start IS NULL) = (service_period_end IS NULL));--> statement-breakpoint
ALTER TABLE "sale"."invoice_items" ADD CONSTRAINT "invoice_items_service_period_range_check" CHECK (service_period_end IS NULL OR service_period_end >= service_period_start);--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" DROP CONSTRAINT "ar_open_items_status_check", ADD CONSTRAINT "ar_open_items_status_check" CHECK (status IN ('open', 'partially_paid', 'paid', 'written_off', 'void'));--> statement-breakpoint
ALTER TABLE "sale"."invoices" DROP CONSTRAINT "invoices_status_check", ADD CONSTRAINT "invoices_status_check" CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'written_off', 'void', 'cancelled'));