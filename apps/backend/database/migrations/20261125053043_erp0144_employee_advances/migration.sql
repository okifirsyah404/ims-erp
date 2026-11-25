CREATE TABLE "finance"."employee_advances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"employee_id" uuid,
	"project_id" uuid,
	"amount" bigint DEFAULT 0 NOT NULL,
	"settled_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"request_date" date,
	"purpose" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"requested_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"disbursed_at" bigint,
	"payment_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_advances_currency_idr_check" CHECK (currency_code = 'IDR'),
	CONSTRAINT "employee_advances_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'disbursed', 'settled', 'cancelled')),
	CONSTRAINT "employee_advances_amount_check" CHECK (amount > 0),
	CONSTRAINT "employee_advances_settled_amount_check" CHECK (settled_amount >= 0),
	CONSTRAINT "employee_advances_settled_le_amount_check" CHECK (settled_amount <= amount)
);
--> statement-breakpoint
CREATE TABLE "finance"."expense_settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"expense_settlement_id" uuid NOT NULL,
	"expense_date" date,
	"category_code" text,
	"description" text,
	"amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"is_advance_offset" boolean DEFAULT false NOT NULL,
	"project_id" uuid,
	"receipt_document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "expense_settlement_items_currency_idr_check" CHECK (currency_code = 'IDR'),
	CONSTRAINT "expense_settlement_items_amount_check" CHECK (amount >= 0),
	CONSTRAINT "expense_settlement_items_tax_amount_check" CHECK (tax_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."expense_settlements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"employee_id" uuid,
	"project_id" uuid,
	"settlement_type" text DEFAULT 'expense' NOT NULL,
	"employee_advance_id" uuid,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"advance_offset_amount" bigint DEFAULT 0 NOT NULL,
	"payable_amount" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"journal_entry_id" uuid,
	"payment_id" uuid,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"settlement_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_by" text,
	"submitted_at" bigint,
	"verified_by" text,
	"verified_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "expense_settlements_currency_idr_check" CHECK (currency_code = 'IDR'),
	CONSTRAINT "expense_settlements_settlement_type_check" CHECK (settlement_type IN ('expense', 'advance')),
	CONSTRAINT "expense_settlements_status_check" CHECK (status IN ('draft', 'submitted', 'verified', 'approved', 'rejected', 'paid', 'cancelled')),
	CONSTRAINT "expense_settlements_total_amount_check" CHECK (total_amount >= 0),
	CONSTRAINT "expense_settlements_split_check" CHECK (advance_offset_amount >= 0 AND payable_amount >= 0),
	CONSTRAINT "expense_settlements_paid_check" CHECK (paid_amount >= 0 AND paid_amount <= payable_amount)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "employee_advances_org_code_uq" ON "finance"."employee_advances" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "employee_advances_employee_id_idx" ON "finance"."employee_advances" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_advances_project_id_idx" ON "finance"."employee_advances" ("project_id");--> statement-breakpoint
CREATE INDEX "employee_advances_status_idx" ON "finance"."employee_advances" ("status");--> statement-breakpoint
CREATE INDEX "expense_settlement_items_settlement_id_idx" ON "finance"."expense_settlement_items" ("expense_settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_settlements_org_code_uq" ON "finance"."expense_settlements" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "expense_settlements_employee_id_idx" ON "finance"."expense_settlements" ("employee_id");--> statement-breakpoint
CREATE INDEX "expense_settlements_advance_id_idx" ON "finance"."expense_settlements" ("employee_advance_id");--> statement-breakpoint
CREATE INDEX "expense_settlements_status_idx" ON "finance"."expense_settlements" ("status");--> statement-breakpoint
ALTER TABLE "finance"."expense_settlement_items" ADD CONSTRAINT "expense_settlement_items_b6O0p7P8fnIk_fkey" FOREIGN KEY ("expense_settlement_id") REFERENCES "finance"."expense_settlements"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."expense_settlements" ADD CONSTRAINT "expense_settlements_jWGyrdYo8GyM_fkey" FOREIGN KEY ("employee_advance_id") REFERENCES "finance"."employee_advances"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."expense_settlements" ADD CONSTRAINT "expense_settlements_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;