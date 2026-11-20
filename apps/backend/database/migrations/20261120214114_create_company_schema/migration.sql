CREATE SCHEMA "company";
--> statement-breakpoint
CREATE TABLE "company"."addresses" (
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
CREATE TABLE "company"."profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"legal_name" varchar(200) NOT NULL,
	"trading_name" varchar(200),
	"document_code" varchar(16) NOT NULL,
	"tagline" varchar(300),
	"tax_id" varchar(32),
	"logo_object_key" text,
	"signature_object_key" text,
	"onboarding_object_key" text,
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
	CONSTRAINT "company_settings_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
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
CREATE UNIQUE INDEX "addresses_primary_uq" ON "company"."addresses" ("is_primary") WHERE deleted_at IS NULL AND is_primary;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_singleton_uq" ON "company"."profiles" ((true)) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "company_settings_scope_uq" ON "company"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_primary_per_type_uq" ON "company"."contacts" ("contact_type","is_primary") WHERE deleted_at IS NULL AND is_primary;--> statement-breakpoint
CREATE INDEX "contacts_value_idx" ON "company"."contacts" ("value");