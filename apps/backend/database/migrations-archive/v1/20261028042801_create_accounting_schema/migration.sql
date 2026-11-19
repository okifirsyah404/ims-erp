CREATE SCHEMA "accounting";
--> statement-breakpoint
CREATE TABLE "accounting"."account_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
CREATE TABLE "accounting"."accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
CREATE TABLE "accounting"."bank_account_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"cash_bank_account_id" uuid NOT NULL,
	"chart_of_account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "accounting"."chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
CREATE TABLE "accounting"."journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"accounting_period_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"description" text,
	"source_type" text,
	"source_id" text,
	"idempotency_key" text,
	"source_module" text DEFAULT 'accounting' NOT NULL,
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
	CONSTRAINT "journal_entries_source_module_check" CHECK (source_module IN ('accounting', 'finance', 'sales', 'procurement', 'inventory', 'assets', 'payroll', 'organization'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
CREATE TABLE "accounting"."opening_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
CREATE TABLE "accounting"."tax_corrections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"tax_record_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"reason" text NOT NULL,
	"evidence_document_id" uuid,
	"created_by" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tax_corrections_amount_check" CHECK (amount <> 0),
	CONSTRAINT "tax_corrections_reason_check" CHECK (char_length(trim(reason)) > 0)
);
--> statement-breakpoint
CREATE TABLE "accounting"."tax_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"tax_type_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"taxable_base" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"filing_status" text DEFAULT 'draft' NOT NULL,
	"filed_on" date,
	"verified_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tax_records_period_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "tax_records_taxable_base_check" CHECK (taxable_base >= 0),
	CONSTRAINT "tax_records_tax_amount_check" CHECK (tax_amount >= 0),
	CONSTRAINT "tax_records_filing_status_check" CHECK (filing_status IN ('draft', 'verified', 'filed', 'corrected'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."tax_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"tax_type" text NOT NULL,
	"rate" numeric(9,4) DEFAULT '0' NOT NULL,
	"base_type" text DEFAULT 'gross' NOT NULL,
	"is_inclusive" boolean DEFAULT false NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tax_types_tax_type_check" CHECK (tax_type IN ('ppn', 'pph', 'ppn_input', 'ppn_output', 'other')),
	CONSTRAINT "tax_types_base_type_check" CHECK (base_type IN ('gross', 'net', 'specific')),
	CONSTRAINT "tax_types_rate_check" CHECK (rate >= 0),
	CONSTRAINT "tax_types_effective_range_check" CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE TABLE "accounting"."withholding_tax_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"tax_type_id" uuid NOT NULL,
	"counterparty_type" text,
	"counterparty_id" text,
	"base_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"transaction_date" date,
	"period_year" integer,
	"period_month" integer,
	"status" text DEFAULT 'recorded' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "withholding_base_amount_check" CHECK (base_amount >= 0),
	CONSTRAINT "withholding_tax_amount_check" CHECK (tax_amount >= 0),
	CONSTRAINT "withholding_status_check" CHECK (status IN ('recorded', 'verified', 'paid', 'reversed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_balances_account_period_uq" ON "accounting"."account_balances" ("account_id","accounting_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_org_code_uq" ON "accounting"."accounting_periods" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_period_uq" ON "accounting"."accounting_periods" ("organization_id","period_year","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_account_links_cash_bank_account_id_uq" ON "accounting"."bank_account_links" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_account_links_chart_of_account_id_idx" ON "accounting"."bank_account_links" ("chart_of_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_of_accounts_org_code_uq" ON "accounting"."chart_of_accounts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_parent_account_id_idx" ON "accounting"."chart_of_accounts" ("parent_account_id");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_account_type_idx" ON "accounting"."chart_of_accounts" ("account_type");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_org_code_uq" ON "accounting"."journal_entries" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_idempotency_uq" ON "accounting"."journal_entries" ("organization_id","idempotency_key") WHERE idempotency_key IS NOT NULL AND status <> 'void';--> statement-breakpoint
CREATE INDEX "journal_entries_period_id_idx" ON "accounting"."journal_entries" ("accounting_period_id");--> statement-breakpoint
CREATE INDEX "journal_entries_status_idx" ON "accounting"."journal_entries" ("status");--> statement-breakpoint
CREATE INDEX "journal_entries_entry_date_idx" ON "accounting"."journal_entries" ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "accounting"."journal_entries" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_id_idx" ON "accounting"."journal_lines" ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_id_idx" ON "accounting"."journal_lines" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_lines_line_no_uq" ON "accounting"."journal_lines" ("journal_entry_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_balances_account_date_uq" ON "accounting"."opening_balances" ("account_id","as_of_date");--> statement-breakpoint
CREATE INDEX "tax_corrections_tax_record_id_idx" ON "accounting"."tax_corrections" ("tax_record_id");--> statement-breakpoint
CREATE INDEX "tax_corrections_evidence_document_id_idx" ON "accounting"."tax_corrections" ("evidence_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_records_org_code_uq" ON "accounting"."tax_records" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_records_org_type_period_uq" ON "accounting"."tax_records" ("organization_id","tax_type_id","period_year","period_month") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tax_records_tax_type_id_idx" ON "accounting"."tax_records" ("tax_type_id");--> statement-breakpoint
CREATE INDEX "tax_records_period_idx" ON "accounting"."tax_records" ("organization_id","period_year","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_types_org_code_effective_uq" ON "accounting"."tax_types" ("organization_id","code","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tax_types_effective_from_idx" ON "accounting"."tax_types" ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "withholding_tax_records_org_code_uq" ON "accounting"."withholding_tax_records" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "withholding_tax_records_tax_type_id_idx" ON "accounting"."withholding_tax_records" ("tax_type_id");--> statement-breakpoint
CREATE INDEX "withholding_tax_records_counterparty_idx" ON "accounting"."withholding_tax_records" ("counterparty_type","counterparty_id");--> statement-breakpoint
ALTER TABLE "accounting"."account_balances" ADD CONSTRAINT "account_balances_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."account_balances" ADD CONSTRAINT "account_balances_uAjXjI3C2vZg_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "accounting"."accounting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."bank_account_links" ADD CONSTRAINT "bank_account_links_p6TVhuHQoduP_fkey" FOREIGN KEY ("chart_of_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entries" ADD CONSTRAINT "journal_entries_accounting_period_id_accounting_periods_id_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "accounting"."accounting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "accounting"."journal_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "accounting"."journal_lines" ADD CONSTRAINT "journal_lines_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."opening_balances" ADD CONSTRAINT "opening_balances_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."tax_corrections" ADD CONSTRAINT "tax_corrections_tax_record_id_tax_records_id_fkey" FOREIGN KEY ("tax_record_id") REFERENCES "accounting"."tax_records"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."tax_records" ADD CONSTRAINT "tax_records_tax_type_id_tax_types_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "accounting"."tax_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."withholding_tax_records" ADD CONSTRAINT "withholding_tax_records_tax_type_id_tax_types_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "accounting"."tax_types"("id") ON DELETE RESTRICT;
