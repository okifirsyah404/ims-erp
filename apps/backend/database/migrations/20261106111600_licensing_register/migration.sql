CREATE SCHEMA "licensing";
--> statement-breakpoint
CREATE TABLE "licensing"."licensable_applications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"vendor" text,
	"source" text DEFAULT 'third_party' NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "licensable_applications_source_check" CHECK ("source" IN ('third_party', 'own')),
	CONSTRAINT "licensable_applications_status_check" CHECK ("status" IN ('active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "licensing"."license_contracts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"licensable_application_id" uuid NOT NULL,
	"package_name" varchar(200),
	"sales_order_id" uuid,
	"start_date" date,
	"end_date" date,
	"billing_cycle" text DEFAULT 'annual' NOT NULL,
	"contract_value" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"renewed_from_contract_id" uuid,
	"notes" text,
	"created_by" text,
	"activated_by" text,
	"activated_at" bigint,
	"terminated_by" text,
	"terminated_at" bigint,
	"termination_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "license_contracts_billing_cycle_check" CHECK ("billing_cycle" IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time')),
	CONSTRAINT "license_contracts_status_check" CHECK ("status" IN ('draft', 'active', 'suspended', 'terminated', 'renewed')),
	CONSTRAINT "license_contracts_value_check" CHECK ("contract_value" >= 0),
	CONSTRAINT "license_contracts_dates_check" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date")
);
--> statement-breakpoint
CREATE TABLE "licensing"."license_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_contract_id" uuid NOT NULL,
	"license_key" text NOT NULL,
	"key_source" text DEFAULT 'vendor' NOT NULL,
	"max_activations" integer DEFAULT 1 NOT NULL,
	"expires_on" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" text,
	"revoked_by" text,
	"revoked_at" bigint,
	"revoke_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "license_keys_source_check" CHECK ("key_source" IN ('vendor', 'generated')),
	CONSTRAINT "license_keys_status_check" CHECK ("status" IN ('active', 'revoked')),
	CONSTRAINT "license_keys_max_activations_check" CHECK ("max_activations" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "licensable_applications_code_uq" ON "licensing"."licensable_applications" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "license_contracts_code_uq" ON "licensing"."license_contracts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_contracts_customer_id_idx" ON "licensing"."license_contracts" ("customer_id");--> statement-breakpoint
CREATE INDEX "license_contracts_application_id_idx" ON "licensing"."license_contracts" ("licensable_application_id");--> statement-breakpoint
CREATE INDEX "license_contracts_status_idx" ON "licensing"."license_contracts" ("status");--> statement-breakpoint
CREATE INDEX "license_contracts_end_date_idx" ON "licensing"."license_contracts" ("end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "license_keys_key_uq" ON "licensing"."license_keys" ("license_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_keys_contract_id_idx" ON "licensing"."license_keys" ("license_contract_id");--> statement-breakpoint
ALTER TABLE "licensing"."license_contracts" ADD CONSTRAINT "license_contracts_EmkWNAhpYDFm_fkey" FOREIGN KEY ("licensable_application_id") REFERENCES "licensing"."licensable_applications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_contracts" ADD CONSTRAINT "license_contracts_dhmyZryN6ou8_fkey" FOREIGN KEY ("renewed_from_contract_id") REFERENCES "licensing"."license_contracts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "licensing"."license_keys" ADD CONSTRAINT "license_keys_license_contract_id_license_contracts_id_fkey" FOREIGN KEY ("license_contract_id") REFERENCES "licensing"."license_contracts"("id") ON DELETE RESTRICT;