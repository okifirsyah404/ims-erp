-- ERP-0042 (1/3): the `company` schema.
-- Hand-written, append-only (same convention as 20261113090000: no
-- snapshot.json, the repo carries no drizzle-kit journal).
--
-- Moves the company-wide master data out of `organization`:
--   organization.company_profiles      -> company.profiles
--                                       + company.head_office_addresses
--                                       + company.contacts
--   organization.company_bank_accounts -> company.bank_accounts
--   organization.company_settings      -> organization.settings (renamed, and
--                                         company.settings is created new)
-- The old tables are dropped after the copy, so this migration is one step
-- and never leaves two sources of truth.

CREATE SCHEMA IF NOT EXISTS "company";

CREATE TABLE IF NOT EXISTS "company"."profiles" (
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
	"status" text NOT NULL DEFAULT 'active',
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "profiles_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "profiles_document_code_check" CHECK ("document_code" ~ '^[A-Z0-9]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_singleton_uq"
	ON "company"."profiles" ((true))
	WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "company"."head_office_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"label" varchar(100) NOT NULL DEFAULT 'head_office',
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"is_primary" boolean NOT NULL DEFAULT false,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS "head_office_addresses_primary_uq"
	ON "company"."head_office_addresses" ("is_primary")
	WHERE "deleted_at" IS NULL AND "is_primary";

CREATE TABLE IF NOT EXISTS "company"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"contact_type" text NOT NULL,
	"value" varchar(200) NOT NULL,
	"label" varchar(100),
	"is_primary" boolean NOT NULL DEFAULT false,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "contacts_contact_type_check"
		CHECK ("contact_type" IN ('phone', 'email', 'whatsapp', 'fax', 'other'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_primary_per_type_uq"
	ON "company"."contacts" ("contact_type", "is_primary")
	WHERE "deleted_at" IS NULL AND "is_primary";
CREATE INDEX IF NOT EXISTS "contacts_value_idx" ON "company"."contacts" ("value");

CREATE TABLE IF NOT EXISTS "company"."bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"bank_code" varchar(20),
	"branch_name" varchar(100),
	"account_number" varchar(50) NOT NULL,
	"account_holder" varchar(200) NOT NULL,
	"currency_code" varchar(3) NOT NULL DEFAULT 'IDR',
	"invoice_usage" text,
	"is_primary" boolean NOT NULL DEFAULT false,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "bank_accounts_invoice_usage_check"
		CHECK ("invoice_usage" IS NULL OR "invoice_usage" IN ('vat', 'non_vat'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_code_uq"
	ON "company"."bank_accounts" ("code")
	WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_invoice_usage_uq"
	ON "company"."bank_accounts" ("invoice_usage")
	WHERE "deleted_at" IS NULL AND "invoice_usage" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "bank_accounts_account_number_idx"
	ON "company"."bank_accounts" ("account_number");

CREATE TABLE IF NOT EXISTS "company"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text NOT NULL DEFAULT 'string',
	"is_secret" boolean NOT NULL DEFAULT false,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "settings_value_type_check"
		CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "settings_scope_uq"
	ON "company"."settings" ("setting_group", "setting_key")
	WHERE "deleted_at" IS NULL;

-- Copy the profile, splitting the contact columns into their own tables.
INSERT INTO "company"."profiles" (
	"id", "legal_name", "trading_name", "document_code", "tagline", "tax_id",
	"logo_object_key", "signature_object_key", "signatory_name", "signatory_title",
	"default_quotation_terms", "default_invoice_terms", "warranty_coverage",
	"warranty_exclusions", "warranty_service_terms", "status", "updated_by",
	"created_at", "updated_at", "deleted_at"
)
SELECT
	"id", "legal_name", "trading_name", "document_code", "tagline", "tax_id",
	"logo_object_key", "signature_object_key", "signatory_name", "signatory_title",
	"default_quotation_terms", "default_invoice_terms", "warranty_coverage",
	"warranty_exclusions", "warranty_service_terms", "status", "updated_by",
	"created_at", "updated_at", "deleted_at"
FROM "organization"."company_profiles"
WHERE NOT EXISTS (SELECT 1 FROM "company"."profiles");

INSERT INTO "company"."head_office_addresses" (
	"label", "address_line", "village_id", "postal_code", "is_primary",
	"created_at", "updated_at"
)
SELECT
	'head_office', "address_line", "address_village_id", "postal_code", true,
	"created_at", "updated_at"
FROM "organization"."company_profiles"
WHERE "address_line" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "company"."head_office_addresses");

INSERT INTO "company"."contacts" (
	"contact_type", "value", "label", "is_primary", "created_at", "updated_at"
)
SELECT 'phone', "phone", 'Phone', true, "created_at", "updated_at"
FROM "organization"."company_profiles"
WHERE "phone" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "company"."contacts")
UNION ALL
SELECT 'email', "email", 'Email', true, "created_at", "updated_at"
FROM "organization"."company_profiles"
WHERE "email" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "company"."contacts")
UNION ALL
SELECT 'other', "website", 'Website', false, "created_at", "updated_at"
FROM "organization"."company_profiles"
WHERE "website" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "company"."contacts");

INSERT INTO "company"."bank_accounts" (
	"id", "code", "bank_name", "bank_code", "branch_name", "account_number",
	"account_holder", "currency_code", "invoice_usage", "is_primary",
	"is_active", "created_at", "updated_at", "deleted_at"
)
SELECT
	"id", "code", "bank_name", "bank_code", "branch_name", "account_number",
	"account_holder", "currency_code", "invoice_usage", "is_primary",
	"is_active", "created_at", "updated_at", "deleted_at"
FROM "organization"."company_bank_accounts"
WHERE NOT EXISTS (SELECT 1 FROM "company"."bank_accounts");

DROP TABLE IF EXISTS "organization"."company_profiles";
DROP TABLE IF EXISTS "organization"."company_bank_accounts";

-- Organization-scoped settings (the planned organization.company_settings).
CREATE TABLE IF NOT EXISTS "organization"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text NOT NULL DEFAULT 'string',
	"is_secret" boolean NOT NULL DEFAULT false,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "settings_value_type_check"
		CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "settings_scope_uq"
	ON "organization"."settings" ("organization_id", "setting_group", "setting_key")
	WHERE "deleted_at" IS NULL;

DROP TABLE IF EXISTS "organization"."company_settings";
