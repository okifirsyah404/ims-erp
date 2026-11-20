CREATE SCHEMA "licensing";
--> statement-breakpoint
CREATE TABLE "licensing"."application_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"licensable_application_id" uuid NOT NULL,
	"api_key_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_start" varchar(20),
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"revoked_by" text,
	"revoked_at" bigint,
	"last_used_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "application_api_keys_status_check" CHECK ("status" IN ('active', 'revoked'))
);
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
CREATE TABLE "licensing"."license_activations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_key_id" uuid NOT NULL,
	"instance_id" varchar(200) NOT NULL,
	"device_name" varchar(200),
	"activated_at" bigint NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"last_ip" text,
	"status" text DEFAULT 'active' NOT NULL,
	"deactivated_at" bigint,
	"deactivated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "license_activations_status_check" CHECK ("status" IN ('active', 'deactivated'))
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
CREATE TABLE "licensing"."license_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_key_id" uuid,
	"license_contract_id" uuid,
	"application_api_key_id" uuid,
	"event_type" text NOT NULL,
	"result" text NOT NULL,
	"instance_id" varchar(200),
	"ip_address" text,
	"actor_user_id" text,
	"description" text,
	"event_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "license_events_event_type_check" CHECK ("event_type" IN ('validated', 'activated', 'deactivated', 'renewed', 'suspended', 'reactivated', 'terminated', 'key_revoked'))
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
CREATE INDEX "application_api_keys_application_id_idx" ON "licensing"."application_api_keys" ("licensable_application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_api_keys_api_key_id_uq" ON "licensing"."application_api_keys" ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licensable_applications_code_uq" ON "licensing"."licensable_applications" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_activations_key_id_idx" ON "licensing"."license_activations" ("license_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_activations_active_uq" ON "licensing"."license_activations" ("license_key_id","instance_id") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "license_contracts_code_uq" ON "licensing"."license_contracts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_contracts_customer_id_idx" ON "licensing"."license_contracts" ("customer_id");--> statement-breakpoint
CREATE INDEX "license_contracts_application_id_idx" ON "licensing"."license_contracts" ("licensable_application_id");--> statement-breakpoint
CREATE INDEX "license_contracts_status_idx" ON "licensing"."license_contracts" ("status");--> statement-breakpoint
CREATE INDEX "license_contracts_end_date_idx" ON "licensing"."license_contracts" ("end_date");--> statement-breakpoint
CREATE INDEX "license_events_key_id_idx" ON "licensing"."license_events" ("license_key_id");--> statement-breakpoint
CREATE INDEX "license_events_contract_id_idx" ON "licensing"."license_events" ("license_contract_id");--> statement-breakpoint
CREATE INDEX "license_events_event_at_idx" ON "licensing"."license_events" ("event_at");--> statement-breakpoint
CREATE UNIQUE INDEX "license_keys_key_uq" ON "licensing"."license_keys" ("license_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_keys_contract_id_idx" ON "licensing"."license_keys" ("license_contract_id");--> statement-breakpoint
ALTER TABLE "licensing"."application_api_keys" ADD CONSTRAINT "application_api_keys_o1w5iIa8QWO5_fkey" FOREIGN KEY ("licensable_application_id") REFERENCES "licensing"."licensable_applications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_activations" ADD CONSTRAINT "license_activations_license_key_id_license_keys_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "licensing"."license_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_contracts" ADD CONSTRAINT "license_contracts_EmkWNAhpYDFm_fkey" FOREIGN KEY ("licensable_application_id") REFERENCES "licensing"."licensable_applications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_contracts" ADD CONSTRAINT "license_contracts_dhmyZryN6ou8_fkey" FOREIGN KEY ("renewed_from_contract_id") REFERENCES "licensing"."license_contracts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "licensing"."license_events" ADD CONSTRAINT "license_events_license_key_id_license_keys_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "licensing"."license_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_events" ADD CONSTRAINT "license_events_license_contract_id_license_contracts_id_fkey" FOREIGN KEY ("license_contract_id") REFERENCES "licensing"."license_contracts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_events" ADD CONSTRAINT "license_events_zNKYspG3nXkU_fkey" FOREIGN KEY ("application_api_key_id") REFERENCES "licensing"."application_api_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_keys" ADD CONSTRAINT "license_keys_license_contract_id_license_contracts_id_fkey" FOREIGN KEY ("license_contract_id") REFERENCES "licensing"."license_contracts"("id") ON DELETE RESTRICT;
