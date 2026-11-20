CREATE SCHEMA "company";
--> statement-breakpoint
CREATE TABLE "company"."bank_accounts" (
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
	CONSTRAINT "bank_accounts_invoice_usage_check" CHECK ("invoice_usage" IS NULL OR "invoice_usage" IN ('vat', 'non_vat'))
);
--> statement-breakpoint
CREATE TABLE "company"."profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"legal_name" varchar(200) NOT NULL,
	"trading_name" varchar(200),
	"document_code" varchar(16) NOT NULL,
	"tagline" varchar(300),
	"tax_id" varchar(32),
	"logo_object_key" text,
	"signature_object_key" text,
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
	CONSTRAINT "profiles_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "profiles_document_code_check" CHECK ("document_code" ~ '^[A-Z0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "company"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "settings_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "company"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"contact_type" text NOT NULL,
	"value" varchar(200) NOT NULL,
	"label" varchar(100),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "contacts_contact_type_check" CHECK ("contact_type" IN ('phone', 'email', 'whatsapp', 'fax', 'other'))
);
--> statement-breakpoint
CREATE TABLE "company"."head_office_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"label" varchar(100) DEFAULT 'head_office' NOT NULL,
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_code_uq" ON "company"."bank_accounts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_invoice_usage_uq" ON "company"."bank_accounts" ("invoice_usage") WHERE deleted_at IS NULL AND invoice_usage IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bank_accounts_account_number_idx" ON "company"."bank_accounts" ("account_number");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_singleton_uq" ON "company"."profiles" ((true)) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "settings_scope_uq" ON "company"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_primary_per_type_uq" ON "company"."contacts" ("contact_type","is_primary") WHERE deleted_at IS NULL AND is_primary;--> statement-breakpoint
CREATE INDEX "contacts_value_idx" ON "company"."contacts" ("value");--> statement-breakpoint
CREATE UNIQUE INDEX "head_office_addresses_primary_uq" ON "company"."head_office_addresses" ("is_primary") WHERE deleted_at IS NULL AND is_primary;
