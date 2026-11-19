CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TABLE "finance"."ap_open_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"supplier_id" uuid,
	"bill_date" date,
	"due_date" date,
	"original_amount" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"outstanding_amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "ap_open_items_status_check" CHECK (status IN ('open', 'partially_paid', 'paid', 'void')),
	CONSTRAINT "ap_open_items_original_check" CHECK (original_amount >= 0),
	CONSTRAINT "ap_open_items_paid_check" CHECK (paid_amount >= 0),
	CONSTRAINT "ap_open_items_outstanding_check" CHECK (outstanding_amount >= 0),
	CONSTRAINT "ap_open_items_consistency_check" CHECK (outstanding_amount = original_amount - paid_amount)
);
--> statement-breakpoint
CREATE TABLE "finance"."ar_open_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"customer_id" uuid,
	"invoice_date" date,
	"due_date" date,
	"original_amount" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"outstanding_amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "ar_open_items_status_check" CHECK (status IN ('open', 'partially_paid', 'paid', 'void')),
	CONSTRAINT "ar_open_items_original_check" CHECK (original_amount >= 0),
	CONSTRAINT "ar_open_items_paid_check" CHECK (paid_amount >= 0),
	CONSTRAINT "ar_open_items_outstanding_check" CHECK (outstanding_amount >= 0),
	CONSTRAINT "ar_open_items_consistency_check" CHECK (outstanding_amount = original_amount - paid_amount)
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"bank_reconciliation_id" uuid NOT NULL,
	"cash_bank_transaction_id" uuid,
	"statement_reference" text,
	"statement_amount" bigint,
	"is_matched" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"cash_bank_account_id" uuid NOT NULL,
	"reconciliation_date" date NOT NULL,
	"statement_balance" bigint DEFAULT 0 NOT NULL,
	"book_balance" bigint DEFAULT 0 NOT NULL,
	"difference" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reconciled_by" text,
	"reconciled_at" bigint,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "bank_reconciliations_status_check" CHECK (status IN ('draft', 'in_progress', 'reconciled', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "finance"."cash_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"account_type" text DEFAULT 'bank' NOT NULL,
	"bank_name" text,
	"account_number" text,
	"account_holder" text,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"current_balance" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "cash_bank_accounts_type_check" CHECK (account_type IN ('cash', 'bank', 'ewallet', 'clearing')),
	CONSTRAINT "cash_bank_accounts_opening_check" CHECK (opening_balance >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."cash_bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"cash_bank_account_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"source_type" text,
	"source_id" text,
	"description" text,
	"reference_number" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"balance_after" bigint DEFAULT 0 NOT NULL,
	"posted_by" text,
	"posted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "cash_bank_transactions_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "cash_bank_transactions_amount_check" CHECK (amount > 0),
	CONSTRAINT "cash_bank_transactions_status_check" CHECK (status IN ('posted', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "finance"."payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"payment_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"sales_invoice_id" uuid,
	"supplier_bill_id" uuid,
	"amount" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "payment_allocations_target_check" CHECK (target_type IN ('sales_invoice', 'supplier_bill')),
	CONSTRAINT "payment_allocations_target_present_check" CHECK ((target_type = 'sales_invoice' AND sales_invoice_id IS NOT NULL) OR (target_type = 'supplier_bill' AND supplier_bill_id IS NOT NULL)),
	CONSTRAINT "payment_allocations_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"discount_percent" numeric(5,2),
	"discount_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payment_terms_days_check" CHECK (days >= 0),
	CONSTRAINT "payment_terms_discount_check" CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100))
);
--> statement-breakpoint
CREATE TABLE "finance"."payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"payment_type" text NOT NULL,
	"direction" text NOT NULL,
	"counterparty_type" text,
	"counterparty_id" text,
	"sales_invoice_id" uuid,
	"supplier_bill_id" uuid,
	"employee_advance_id" uuid,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"payment_method" text DEFAULT 'bank_transfer' NOT NULL,
	"payment_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"requested_by" text,
	"requested_at" bigint,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"executed_by" text,
	"executed_at" bigint,
	"cash_bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payments_type_check" CHECK (payment_type IN ('receipt', 'disbursement', 'refund', 'advance_disbursement', 'payroll', 'profit_distribution', 'investment')),
	CONSTRAINT "payments_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "payments_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'executed', 'reversed', 'void', 'cancelled')),
	CONSTRAINT "payments_amount_check" CHECK (amount > 0),
	CONSTRAINT "payments_method_check" CHECK (payment_method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque', 'offset'))
);
--> statement-breakpoint
CREATE TABLE "finance"."supplier_bills" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"bill_date" date,
	"due_date" date,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"paid_total" bigint DEFAULT 0 NOT NULL,
	"outstanding_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_bills_status_check" CHECK (status IN ('draft', 'approved', 'partially_paid', 'paid', 'overdue', 'void')),
	CONSTRAINT "supplier_bills_subtotal_check" CHECK (subtotal >= 0),
	CONSTRAINT "supplier_bills_tax_total_check" CHECK (tax_total >= 0),
	CONSTRAINT "supplier_bills_grand_total_check" CHECK (grand_total >= 0),
	CONSTRAINT "supplier_bills_paid_total_check" CHECK (paid_total >= 0),
	CONSTRAINT "supplier_bills_outstanding_total_check" CHECK (outstanding_total >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ap_open_items_org_bill_uq" ON "finance"."ap_open_items" ("organization_id","supplier_bill_id");--> statement-breakpoint
CREATE INDEX "ap_open_items_supplier_id_idx" ON "finance"."ap_open_items" ("supplier_id");--> statement-breakpoint
CREATE INDEX "ap_open_items_status_idx" ON "finance"."ap_open_items" ("status");--> statement-breakpoint
CREATE INDEX "ap_open_items_due_date_idx" ON "finance"."ap_open_items" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ar_open_items_org_invoice_uq" ON "finance"."ar_open_items" ("organization_id","sales_invoice_id");--> statement-breakpoint
CREATE INDEX "ar_open_items_customer_id_idx" ON "finance"."ar_open_items" ("customer_id");--> statement-breakpoint
CREATE INDEX "ar_open_items_status_idx" ON "finance"."ar_open_items" ("status");--> statement-breakpoint
CREATE INDEX "ar_open_items_due_date_idx" ON "finance"."ar_open_items" ("due_date");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_items_reconciliation_id_idx" ON "finance"."bank_reconciliation_items" ("bank_reconciliation_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_items_transaction_id_idx" ON "finance"."bank_reconciliation_items" ("cash_bank_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_reconciliations_org_code_uq" ON "finance"."bank_reconciliations" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_account_id_idx" ON "finance"."bank_reconciliations" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_date_idx" ON "finance"."bank_reconciliations" ("reconciliation_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_bank_accounts_org_code_uq" ON "finance"."cash_bank_accounts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cash_bank_accounts_account_number_idx" ON "finance"."cash_bank_accounts" ("account_number");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_bank_transactions_org_code_uq" ON "finance"."cash_bank_transactions" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cash_bank_transactions_account_id_idx" ON "finance"."cash_bank_transactions" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "cash_bank_transactions_date_idx" ON "finance"."cash_bank_transactions" ("transaction_date");--> statement-breakpoint
CREATE INDEX "cash_bank_transactions_source_idx" ON "finance"."cash_bank_transactions" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_idx" ON "finance"."payment_allocations" ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_sales_invoice_id_idx" ON "finance"."payment_allocations" ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_supplier_bill_id_idx" ON "finance"."payment_allocations" ("supplier_bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_terms_org_code_uq" ON "finance"."payment_terms" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_org_code_uq" ON "finance"."payments" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "payments_sales_invoice_id_idx" ON "finance"."payments" ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "payments_supplier_bill_id_idx" ON "finance"."payments" ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "finance"."payments" ("status");--> statement-breakpoint
CREATE INDEX "payments_counterparty_idx" ON "finance"."payments" ("organization_id","counterparty_type","counterparty_id");--> statement-breakpoint
CREATE INDEX "payments_cash_bank_account_id_idx" ON "finance"."payments" ("cash_bank_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_bills_org_code_uq" ON "finance"."supplier_bills" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "supplier_bills_supplier_id_idx" ON "finance"."supplier_bills" ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_bills_purchase_order_id_idx" ON "finance"."supplier_bills" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_bills_status_idx" ON "finance"."supplier_bills" ("status");--> statement-breakpoint
CREATE INDEX "supplier_bills_due_date_idx" ON "finance"."supplier_bills" ("due_date");--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_LO96nU6SLCO6_fkey" FOREIGN KEY ("bank_reconciliation_id") REFERENCES "finance"."bank_reconciliations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_5ntduObVqjWU_fkey" FOREIGN KEY ("cash_bank_transaction_id") REFERENCES "finance"."cash_bank_transactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_uOpNUxTRLd4E_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_OiQ8fTWxqUGx_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."payments" ADD CONSTRAINT "payments_cash_bank_account_id_cash_bank_accounts_id_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;
