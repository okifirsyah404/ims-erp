CREATE SCHEMA "supplier";
--> statement-breakpoint
CREATE TABLE "supplier"."addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"supplier_id" uuid NOT NULL,
	"kind" text DEFAULT 'office' NOT NULL,
	"label" text,
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_addresses_kind_check" CHECK ("kind" IN ('office', 'other'))
);
--> statement-breakpoint
CREATE TABLE "supplier"."code_numberings" (
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
	CONSTRAINT "supplier_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "supplier_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "supplier"."companies" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"supplier_type" text DEFAULT 'company' NOT NULL,
	"tax_id" varchar(16),
	"email" text,
	"phone" varchar(30),
	"whatsapp" varchar(30),
	"website" varchar(200),
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"payment_term_note" varchar(300),
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_holder" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_companies_type_check" CHECK ("supplier_type" IN ('company', 'government')),
	CONSTRAINT "supplier_companies_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "supplier_companies_payment_terms_check" CHECK ("payment_terms_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier"."company_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"company_id" uuid NOT NULL,
	"kind" text DEFAULT 'office' NOT NULL,
	"label" text,
	"contact_name" text,
	"contact_phone" text,
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_company_addresses_kind_check" CHECK ("kind" IN ('office', 'factory', 'warehouse', 'billing', 'other'))
);
--> statement-breakpoint
CREATE TABLE "supplier"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_settings_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "supplier"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"company_id" uuid,
	"name" text NOT NULL,
	"title" varchar(100),
	"phone" varchar(30),
	"email" text,
	"whatsapp" varchar(30),
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "suppliers_status_check" CHECK ("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE INDEX "supplier_addresses_supplier_id_idx" ON "supplier"."addresses" ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_code_numberings_type_uq" ON "supplier"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_companies_code_uq" ON "supplier"."companies" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "supplier_companies_name_idx" ON "supplier"."companies" ("name");--> statement-breakpoint
CREATE INDEX "supplier_companies_status_idx" ON "supplier"."companies" ("status");--> statement-breakpoint
CREATE INDEX "supplier_companies_tax_id_idx" ON "supplier"."companies" ("tax_id");--> statement-breakpoint
CREATE INDEX "supplier_company_addresses_company_id_idx" ON "supplier"."company_addresses" ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_settings_scope_uq" ON "supplier"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_primary_uq" ON "supplier"."suppliers" ("company_id") WHERE is_primary AND deleted_at IS NULL AND company_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "suppliers_company_id_idx" ON "supplier"."suppliers" ("company_id");--> statement-breakpoint
CREATE INDEX "suppliers_status_idx" ON "supplier"."suppliers" ("status");--> statement-breakpoint
ALTER TABLE "supplier"."addresses" ADD CONSTRAINT "addresses_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"."suppliers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "supplier"."company_addresses" ADD CONSTRAINT "company_addresses_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "supplier"."companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "supplier"."suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "supplier"."companies"("id") ON DELETE RESTRICT;