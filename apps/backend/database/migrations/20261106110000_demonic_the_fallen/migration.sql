-- The schema may already exist: main's ERP-0009 migration 20261104221832
-- creates it with its own document_sequences table (merged 2026-11-06).
CREATE SCHEMA IF NOT EXISTS "organization";
--> statement-breakpoint
CREATE TABLE "organization"."company_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"bank_code" varchar(20),
	"branch_name" varchar(100),
	"account_number" varchar(50) NOT NULL,
	"account_holder" varchar(200) NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"invoice_usage" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "company_bank_accounts_invoice_usage_check" CHECK ("invoice_usage" IS NULL OR "invoice_usage" IN ('vat', 'non_vat'))
);
--> statement-breakpoint
CREATE TABLE "organization"."company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"legal_name" varchar(200) NOT NULL,
	"trading_name" varchar(200),
	"document_code" varchar(16) NOT NULL,
	"tagline" varchar(300),
	"tax_id" varchar(32),
	"email" varchar(200),
	"phone" varchar(100),
	"website" varchar(200),
	"logo_object_key" text,
	"address_line" text,
	"address_village_id" uuid,
	"postal_code" varchar(10),
	"signatory_name" varchar(200),
	"signatory_title" varchar(100),
	"default_quotation_terms" text,
	"default_invoice_terms" text,
	"warranty_coverage" text,
	"warranty_exclusions" text,
	"warranty_service_terms" text,
	"status" text DEFAULT 'active' NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "company_profiles_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "company_profiles_document_code_check" CHECK ("document_code" ~ '^[A-Z0-9]+$')
);
--> statement-breakpoint
-- organization.document_sequences: reshaped from main's ERP-0009 table by
-- 20261106170000_document_sequences_unify (merged numbering, 2026-11-06).
CREATE UNIQUE INDEX "company_bank_accounts_code_uq" ON "organization"."company_bank_accounts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "company_bank_accounts_invoice_usage_uq" ON "organization"."company_bank_accounts" ("invoice_usage") WHERE deleted_at IS NULL AND invoice_usage IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_singleton_uq" ON "organization"."company_profiles" ((true)) WHERE deleted_at IS NULL;--> statement-breakpoint
