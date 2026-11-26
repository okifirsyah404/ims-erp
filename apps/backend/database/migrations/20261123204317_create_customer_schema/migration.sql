CREATE SCHEMA "customer";
--> statement-breakpoint
CREATE TABLE "customer"."addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"customer_id" uuid NOT NULL,
	"kind" text DEFAULT 'residence' NOT NULL,
	"label" text,
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "customer_addresses_kind_check" CHECK ("kind" IN ('residence', 'office', 'billing', 'other'))
);
--> statement-breakpoint
CREATE TABLE "customer"."code_numberings" (
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
	CONSTRAINT "customer_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "customer_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "customer"."companies" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"company_type" text DEFAULT 'company' NOT NULL,
	"tax_id" varchar(16),
	"email" text,
	"phone" varchar(30),
	"website" varchar(200),
	"status" text DEFAULT 'active' NOT NULL,
	"owner_customer_id" uuid,
	"notes" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "customer_companies_type_check" CHECK ("company_type" IN ('company', 'government', 'partner')),
	CONSTRAINT "customer_companies_status_check" CHECK ("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "customer"."company_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"company_id" uuid NOT NULL,
	"kind" text DEFAULT 'billing' NOT NULL,
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
	CONSTRAINT "customer_company_addresses_kind_check" CHECK ("kind" IN ('billing', 'shipping', 'service', 'site', 'other'))
);
--> statement-breakpoint
CREATE TABLE "customer"."settings" (
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
	CONSTRAINT "customer_settings_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "customer"."customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"position" text,
	"phone" varchar(30),
	"customer_type" text DEFAULT 'individual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"user_id" text,
	"portal_role" text,
	"portal_status" text,
	"portal_invited_by" text,
	"portal_last_login_at" bigint,
	"portal_password_change_required" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "customers_type_check" CHECK ("customer_type" IN ('individual', 'contact')),
	CONSTRAINT "customers_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "customers_portal_role_check" CHECK ("portal_role" IS NULL OR "portal_role" IN ('owner', 'approver', 'finance', 'viewer')),
	CONSTRAINT "customers_portal_status_check" CHECK ("portal_status" IS NULL OR "portal_status" IN ('active', 'suspended', 'revoked')),
	CONSTRAINT "customers_company_required_check" CHECK ("company_id" IS NOT NULL OR "customer_type" = 'individual')
);
--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer"."addresses" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_code_numberings_type_uq" ON "customer"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_companies_code_uq" ON "customer"."companies" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "customer_companies_name_idx" ON "customer"."companies" ("name");--> statement-breakpoint
CREATE INDEX "customer_companies_tax_id_idx" ON "customer"."companies" ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_companies_owner_uq" ON "customer"."companies" ("owner_customer_id") WHERE owner_customer_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "customer_company_addresses_company_id_idx" ON "customer"."company_addresses" ("company_id");--> statement-breakpoint
CREATE INDEX "customer_company_addresses_kind_idx" ON "customer"."company_addresses" ("company_id","kind","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_settings_scope_uq" ON "customer"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_uq" ON "customer"."customers" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_uq" ON "customer"."customers" ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "customers_company_id_idx" ON "customer"."customers" ("company_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customer"."customers" ("name");--> statement-breakpoint
ALTER TABLE "customer"."addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer"."companies" ADD CONSTRAINT "companies_owner_customer_id_customers_id_fkey" FOREIGN KEY ("owner_customer_id") REFERENCES "customer"."customers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "customer"."company_addresses" ADD CONSTRAINT "company_addresses_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "customer"."companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD CONSTRAINT "customers_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "customer"."companies"("id") ON DELETE RESTRICT;