CREATE SCHEMA "tax";
--> statement-breakpoint
CREATE TABLE "tax"."code_numberings" (
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
	CONSTRAINT "tax_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "tax_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "tax"."corrections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tax_record_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"reason" text NOT NULL,
	"evidence_document_id" uuid,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tax_corrections_amount_check" CHECK (amount <> 0),
	CONSTRAINT "tax_corrections_reason_check" CHECK (char_length(trim(reason)) > 0)
);
--> statement-breakpoint
CREATE TABLE "tax"."records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
CREATE TABLE "tax"."taxes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
	CONSTRAINT "taxes_tax_type_check" CHECK (tax_type IN ('ppn', 'pph', 'ppn_input', 'ppn_output', 'other')),
	CONSTRAINT "taxes_base_type_check" CHECK (base_type IN ('gross', 'net', 'specific')),
	CONSTRAINT "taxes_rate_check" CHECK (rate >= 0),
	CONSTRAINT "taxes_effective_range_check" CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE TABLE "tax"."withholding_tax_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
CREATE UNIQUE INDEX "tax_code_numberings_type_uq" ON "tax"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tax_corrections_tax_record_id_idx" ON "tax"."corrections" ("tax_record_id");--> statement-breakpoint
CREATE INDEX "tax_corrections_evidence_document_id_idx" ON "tax"."corrections" ("evidence_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_records_org_code_uq" ON "tax"."records" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_records_org_type_period_uq" ON "tax"."records" ("organization_id","tax_type_id","period_year","period_month") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tax_records_tax_type_id_idx" ON "tax"."records" ("tax_type_id");--> statement-breakpoint
CREATE INDEX "tax_records_period_idx" ON "tax"."records" ("organization_id","period_year","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "taxes_org_code_effective_uq" ON "tax"."taxes" ("organization_id","code","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "taxes_effective_from_idx" ON "tax"."taxes" ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "withholding_tax_records_org_code_uq" ON "tax"."withholding_tax_records" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "withholding_tax_records_tax_type_id_idx" ON "tax"."withholding_tax_records" ("tax_type_id");--> statement-breakpoint
CREATE INDEX "withholding_tax_records_counterparty_idx" ON "tax"."withholding_tax_records" ("counterparty_type","counterparty_id");--> statement-breakpoint
ALTER TABLE "tax"."corrections" ADD CONSTRAINT "corrections_tax_record_id_records_id_fkey" FOREIGN KEY ("tax_record_id") REFERENCES "tax"."records"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tax"."records" ADD CONSTRAINT "records_tax_type_id_taxes_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax"."taxes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD CONSTRAINT "withholding_tax_records_tax_type_id_taxes_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax"."taxes"("id") ON DELETE RESTRICT;