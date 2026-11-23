CREATE TABLE "finance"."expense_claim_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"expense_claim_id" uuid NOT NULL,
	"expense_date" date,
	"category_code" text,
	"description" text,
	"amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"receipt_document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "expense_claim_items_amount_check" CHECK (amount >= 0),
	CONSTRAINT "expense_claim_items_tax_amount_check" CHECK (tax_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."expense_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"employee_id" uuid,
	"claim_date" date,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"payment_id" uuid,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "expense_claims_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled')),
	CONSTRAINT "expense_claims_total_amount_check" CHECK (total_amount >= 0)
);
--> statement-breakpoint
CREATE INDEX "expense_claim_items_claim_id_idx" ON "finance"."expense_claim_items" ("expense_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_claims_org_code_uq" ON "finance"."expense_claims" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "expense_claims_employee_id_idx" ON "finance"."expense_claims" ("employee_id");--> statement-breakpoint
CREATE INDEX "expense_claims_status_idx" ON "finance"."expense_claims" ("status");--> statement-breakpoint
ALTER TABLE "finance"."expense_claim_items" ADD CONSTRAINT "expense_claim_items_expense_claim_id_expense_claims_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "finance"."expense_claims"("id") ON DELETE CASCADE;