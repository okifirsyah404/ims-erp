CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TABLE "finance"."account_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"account_id" uuid NOT NULL,
	"accounting_period_id" uuid NOT NULL,
	"balance_date" date NOT NULL,
	"debit_total" bigint DEFAULT 0 NOT NULL,
	"credit_total" bigint DEFAULT 0 NOT NULL,
	"closing_balance" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"calculated_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "account_balances_debit_check" CHECK (debit_total >= 0),
	CONSTRAINT "account_balances_credit_check" CHECK (credit_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_by" text,
	"closed_at" bigint,
	"reopened_by" text,
	"reopened_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "accounting_periods_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "accounting_periods_range_check" CHECK (end_date >= start_date),
	CONSTRAINT "accounting_periods_status_check" CHECK (status IN ('open', 'closed', 'locked'))
);
--> statement-breakpoint
CREATE TABLE "finance"."ap_open_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"supplier_bill_id" uuid NOT NULL,
	"supplier_company_id" uuid,
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
	"organization_id" text,
	"invoice_id" uuid,
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
CREATE TABLE "finance"."asset_depreciations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"depreciation_amount" bigint DEFAULT 0 NOT NULL,
	"opening_book_value" bigint DEFAULT 0 NOT NULL,
	"closing_book_value" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"calculated_at" bigint,
	"journal_entry_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "asset_depreciations_period_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "asset_depreciations_method_check" CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "asset_depreciations_amount_check" CHECK (depreciation_amount >= 0),
	CONSTRAINT "asset_depreciations_closing_check" CHECK (closing_book_value >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_account_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"cash_bank_account_id" uuid NOT NULL,
	"chart_of_account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
	"organization_id" text,
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
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"account_type" text DEFAULT 'bank' NOT NULL,
	"bank_name" text,
	"bank_code" varchar(20),
	"branch_name" varchar(100),
	"account_number" text,
	"account_holder" text,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"current_balance" bigint DEFAULT 0 NOT NULL,
	"invoice_usage" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "cash_bank_accounts_type_check" CHECK (account_type IN ('cash', 'bank', 'ewallet', 'clearing')),
	CONSTRAINT "cash_bank_accounts_opening_check" CHECK (opening_balance >= 0),
	CONSTRAINT "cash_bank_accounts_invoice_usage_check" CHECK (invoice_usage IS NULL OR invoice_usage IN ('vat', 'non_vat'))
);
--> statement-breakpoint
CREATE TABLE "finance"."cash_bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
	CONSTRAINT "cash_bank_transactions_status_check" CHECK (status IN ('draft', 'posted', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "finance"."chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"normal_balance" text DEFAULT 'debit' NOT NULL,
	"parent_account_id" uuid,
	"level" integer DEFAULT 1 NOT NULL,
	"is_postable" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"cash_flow_category" text,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "chart_of_accounts_type_check" CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
	CONSTRAINT "chart_of_accounts_normal_balance_check" CHECK (normal_balance IN ('debit', 'credit')),
	CONSTRAINT "chart_of_accounts_cash_flow_category_check" CHECK (cash_flow_category IS NULL OR cash_flow_category IN ('operating', 'investing', 'financing')),
	CONSTRAINT "chart_of_accounts_level_check" CHECK (level >= 1)
);
--> statement-breakpoint
CREATE TABLE "finance"."code_numberings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code_type" varchar(32) NOT NULL,
	"pattern" varchar(100),
	"reset_policy" text,
	"period_key" varchar(7) NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "finance_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "finance_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"accounting_period_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"description" text,
	"source_type" text,
	"source_id" text,
	"idempotency_key" text,
	"source_module" text DEFAULT 'finance' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_debit" bigint DEFAULT 0 NOT NULL,
	"total_credit" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"prepared_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"posted_by" text,
	"posted_at" bigint,
	"reversed_by_entry_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "journal_entries_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'posted', 'reversed', 'void')),
	CONSTRAINT "journal_entries_total_debit_check" CHECK (total_debit >= 0),
	CONSTRAINT "journal_entries_total_credit_check" CHECK (total_credit >= 0),
	CONSTRAINT "journal_entries_balanced_check" CHECK (total_debit = total_credit),
	CONSTRAINT "journal_entries_source_module_check" CHECK (source_module IN ('finance', 'sale', 'procurement', 'inventory', 'payment', 'tax', 'human_resource'))
);
--> statement-breakpoint
CREATE TABLE "finance"."journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"journal_entry_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"cost_center_id" uuid,
	"project_id" uuid,
	"party_type" text,
	"party_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "journal_lines_debit_check" CHECK (debit >= 0),
	CONSTRAINT "journal_lines_credit_check" CHECK (credit >= 0),
	CONSTRAINT "journal_lines_one_side_check" CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
--> statement-breakpoint
CREATE TABLE "finance"."opening_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"account_id" uuid NOT NULL,
	"as_of_date" date NOT NULL,
	"debit_balance" bigint DEFAULT 0 NOT NULL,
	"credit_balance" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"posted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "opening_balances_debit_check" CHECK (debit_balance >= 0),
	CONSTRAINT "opening_balances_credit_check" CHECK (credit_balance >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
CREATE TABLE "finance"."report_archives" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"report_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_by" text,
	"generated_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "report_archives_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "report_archives_type_check" CHECK (report_type IN ('profit_and_loss', 'balance_sheet', 'cash_flow'))
);
--> statement-breakpoint
CREATE TABLE "finance"."supplier_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"supplier_bill_id" uuid NOT NULL,
	"purchase_order_item_id" uuid,
	"product_id" uuid,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"tax_base" bigint DEFAULT 0 NOT NULL,
	"is_stock" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_bill_items_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "supplier_bill_items_amounts_check" CHECK (unit_price >= 0 AND line_total >= 0 AND tax_base >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."supplier_bills" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"supplier_company_id" uuid,
	"purchase_order_id" uuid,
	"supplier_invoice_number" varchar(100),
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
CREATE UNIQUE INDEX "account_balances_account_period_uq" ON "finance"."account_balances" ("account_id","accounting_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_org_code_uq" ON "finance"."accounting_periods" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_period_uq" ON "finance"."accounting_periods" ("organization_id","period_year","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "ap_open_items_org_bill_uq" ON "finance"."ap_open_items" ("organization_id","supplier_bill_id");--> statement-breakpoint
CREATE INDEX "ap_open_items_supplier_company_id_idx" ON "finance"."ap_open_items" ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "ap_open_items_status_idx" ON "finance"."ap_open_items" ("status");--> statement-breakpoint
CREATE INDEX "ap_open_items_due_date_idx" ON "finance"."ap_open_items" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ar_open_items_org_invoice_uq" ON "finance"."ar_open_items" ("organization_id","invoice_id");--> statement-breakpoint
CREATE INDEX "ar_open_items_customer_id_idx" ON "finance"."ar_open_items" ("customer_id");--> statement-breakpoint
CREATE INDEX "ar_open_items_status_idx" ON "finance"."ar_open_items" ("status");--> statement-breakpoint
CREATE INDEX "ar_open_items_due_date_idx" ON "finance"."ar_open_items" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_depreciations_period_uq" ON "finance"."asset_depreciations" ("item_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "asset_depreciations_period_year_idx" ON "finance"."asset_depreciations" ("period_year");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_account_links_cash_bank_account_id_uq" ON "finance"."bank_account_links" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_account_links_chart_of_account_id_idx" ON "finance"."bank_account_links" ("chart_of_account_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "chart_of_accounts_org_code_uq" ON "finance"."chart_of_accounts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_parent_account_id_idx" ON "finance"."chart_of_accounts" ("parent_account_id");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_account_type_idx" ON "finance"."chart_of_accounts" ("account_type");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_code_numberings_type_uq" ON "finance"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_settings_scope_uq" ON "finance"."settings" ("organization_id","setting_group","setting_key");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_org_code_uq" ON "finance"."journal_entries" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_idempotency_uq" ON "finance"."journal_entries" ("organization_id","idempotency_key") WHERE idempotency_key IS NOT NULL AND status <> 'void';--> statement-breakpoint
CREATE INDEX "journal_entries_period_id_idx" ON "finance"."journal_entries" ("accounting_period_id");--> statement-breakpoint
CREATE INDEX "journal_entries_status_idx" ON "finance"."journal_entries" ("status");--> statement-breakpoint
CREATE INDEX "journal_entries_entry_date_idx" ON "finance"."journal_entries" ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_source_type_idx" ON "finance"."journal_entries" ("source_type");--> statement-breakpoint
CREATE INDEX "journal_entries_source_id_idx" ON "finance"."journal_entries" ("source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_id_idx" ON "finance"."journal_lines" ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_id_idx" ON "finance"."journal_lines" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_lines_line_no_uq" ON "finance"."journal_lines" ("journal_entry_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_balances_account_date_uq" ON "finance"."opening_balances" ("account_id","as_of_date");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_terms_org_code_uq" ON "finance"."payment_terms" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "report_archives_scope_uq" ON "finance"."report_archives" ("organization_id","period_year","period_month","report_type");--> statement-breakpoint
CREATE INDEX "supplier_bill_items_supplier_bill_id_idx" ON "finance"."supplier_bill_items" ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_items_purchase_order_item_id_idx" ON "finance"."supplier_bill_items" ("purchase_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_bills_org_code_uq" ON "finance"."supplier_bills" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "supplier_bills_supplier_company_id_idx" ON "finance"."supplier_bills" ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "supplier_bills_purchase_order_id_idx" ON "finance"."supplier_bills" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_bills_status_idx" ON "finance"."supplier_bills" ("status");--> statement-breakpoint
CREATE INDEX "supplier_bills_due_date_idx" ON "finance"."supplier_bills" ("due_date");--> statement-breakpoint
ALTER TABLE "finance"."account_balances" ADD CONSTRAINT "account_balances_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."account_balances" ADD CONSTRAINT "account_balances_uAjXjI3C2vZg_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "finance"."accounting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."ap_open_items" ADD CONSTRAINT "ap_open_items_supplier_bill_id_supplier_bills_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "finance"."supplier_bills"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."asset_depreciations" ADD CONSTRAINT "asset_depreciations_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."bank_account_links" ADD CONSTRAINT "bank_account_links_9L0JHVXVaDvx_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."bank_account_links" ADD CONSTRAINT "bank_account_links_p6TVhuHQoduP_fkey" FOREIGN KEY ("chart_of_account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_LO96nU6SLCO6_fkey" FOREIGN KEY ("bank_reconciliation_id") REFERENCES "finance"."bank_reconciliations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_5ntduObVqjWU_fkey" FOREIGN KEY ("cash_bank_transaction_id") REFERENCES "finance"."cash_bank_transactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_uOpNUxTRLd4E_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_OiQ8fTWxqUGx_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_accounting_period_id_accounting_periods_id_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "finance"."accounting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."opening_balances" ADD CONSTRAINT "opening_balances_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."supplier_bill_items" ADD CONSTRAINT "supplier_bill_items_supplier_bill_id_supplier_bills_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "finance"."supplier_bills"("id") ON DELETE CASCADE;