CREATE TABLE "finance"."cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"parent_cost_center_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."posting_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"event_type" text DEFAULT '*' NOT NULL,
	"role" text NOT NULL,
	"discriminator_type" text DEFAULT '' NOT NULL,
	"discriminator_value" text DEFAULT '' NOT NULL,
	"account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "posting_rules_discriminator_type_check" CHECK (discriminator_type IN ('', 'product_category', 'tax', 'cash_bank_account', 'expense_category', 'asset_category', 'cost_category')),
	CONSTRAINT "posting_rules_discriminator_pair_check" CHECK ((discriminator_type = '') = (discriminator_value = ''))
);
--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD COLUMN "is_adjusting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD COLUMN "reverses_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "finance"."journal_lines_line_no_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "journal_lines_line_no_uq" ON "finance"."journal_lines" ("journal_entry_id","line_no") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_org_code_uq" ON "finance"."cost_centers" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "cost_centers_parent_id_idx" ON "finance"."cost_centers" ("parent_cost_center_id");--> statement-breakpoint
CREATE INDEX "journal_entries_reverses_entry_id_idx" ON "finance"."journal_entries" ("reverses_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_cost_center_id_idx" ON "finance"."journal_lines" ("cost_center_id");--> statement-breakpoint
CREATE INDEX "journal_lines_project_id_idx" ON "finance"."journal_lines" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "posting_rules_scope_uq" ON "finance"."posting_rules" ("organization_id","event_type","role","discriminator_type","discriminator_value") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "posting_rules_account_id_idx" ON "finance"."posting_rules" ("account_id");--> statement-breakpoint
ALTER TABLE "finance"."cost_centers" ADD CONSTRAINT "cost_centers_parent_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("parent_cost_center_id") REFERENCES "finance"."cost_centers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_reverses_entry_id_journal_entries_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "finance"."cost_centers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."posting_rules" ADD CONSTRAINT "posting_rules_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."account_balances" ADD CONSTRAINT "account_balances_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."ap_open_items" ADD CONSTRAINT "ap_open_items_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."ar_open_items" ADD CONSTRAINT "ar_open_items_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."asset_depreciations" ADD CONSTRAINT "asset_depreciations_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."expense_claim_items" ADD CONSTRAINT "expense_claim_items_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."expense_claims" ADD CONSTRAINT "expense_claims_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_code_posted_check" CHECK (code IS NOT NULL OR status IN ('draft', 'submitted', 'approved', 'void'));--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."opening_balances" ADD CONSTRAINT "opening_balances_currency_idr_check" CHECK (currency_code = 'IDR');--> statement-breakpoint
ALTER TABLE "finance"."supplier_bills" ADD CONSTRAINT "supplier_bills_currency_idr_check" CHECK (currency_code = 'IDR');