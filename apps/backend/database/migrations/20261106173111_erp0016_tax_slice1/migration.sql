CREATE SCHEMA "accounting";
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
ALTER TABLE "accounting"."tax_corrections" ADD CONSTRAINT "tax_corrections_tax_record_id_tax_records_id_fkey" FOREIGN KEY ("tax_record_id") REFERENCES "accounting"."tax_records"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."tax_records" ADD CONSTRAINT "tax_records_tax_type_id_tax_types_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "accounting"."tax_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounting"."withholding_tax_records" ADD CONSTRAINT "withholding_tax_records_tax_type_id_tax_types_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "accounting"."tax_types"("id") ON DELETE RESTRICT;