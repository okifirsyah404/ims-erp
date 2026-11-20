CREATE SCHEMA "project";
--> statement-breakpoint
CREATE TABLE "project"."addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"kind" text DEFAULT 'site' NOT NULL,
	"label" text,
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"latitude" numeric(10,7),
	"longitude" numeric(10,7),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "project_addresses_kind_check" CHECK ("kind" IN ('site', 'billing', 'other'))
);
--> statement-breakpoint
CREATE TABLE "project"."costs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"category" text NOT NULL,
	"cost_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"description" varchar(300) NOT NULL,
	"receipt_storage_key" text,
	"receipt_file_name" varchar(200),
	"receipt_content_type" varchar(100),
	"created_by" text,
	"voided_by" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "costs_category_check" CHECK ("category" IN ('material', 'transport', 'accommodation', 'subcontract', 'other')),
	CONSTRAINT "costs_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "project"."evidence" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"note" varchar(500),
	"uploaded_by" text,
	"deleted_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "evidence_kind_check" CHECK ("kind" IN ('testing', 'training', 'bast', 'photo', 'other')),
	CONSTRAINT "evidence_size_check" CHECK ("size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "project"."handover" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"bast_date" date NOT NULL,
	"first_party_company" varchar(200) NOT NULL,
	"first_party_name" varchar(120) NOT NULL,
	"first_party_title" varchar(120) NOT NULL,
	"second_party_company" varchar(200) NOT NULL,
	"second_party_name" varchar(120) NOT NULL,
	"second_party_title" varchar(120) NOT NULL,
	"contract_number" varchar(120),
	"work_title" varchar(300) NOT NULL,
	"project_name" varchar(200),
	"items" jsonb NOT NULL,
	"scope" jsonb NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"created_by" text,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "handover_status_check" CHECK ("status" IN ('issued', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "project"."lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"lead_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"notes" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "lead_activities_type_check" CHECK ("activity_type" IN ('call', 'whatsapp', 'email', 'meeting', 'survey', 'note'))
);
--> statement-breakpoint
CREATE TABLE "project"."lead_attachments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"lead_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "project"."leads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"company_name" text,
	"company_id" uuid,
	"email" text,
	"phone" varchar(30),
	"whatsapp" varchar(30),
	"source" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"needs" text,
	"estimated_value" bigint,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"owner_user_id" text,
	"next_follow_up_at" bigint,
	"customer_id" uuid,
	"converted_at" bigint,
	"lost_reason" text,
	"channel" text,
	"reference" varchar(40),
	"submission" jsonb,
	"idempotency_key" varchar(100),
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "leads_source_check" CHECK ("source" IN ('website', 'whatsapp', 'instagram', 'phone', 'referral', 'walk_in', 'other')),
	CONSTRAINT "leads_status_check" CHECK ("status" IN ('new', 'contacted', 'survey', 'quotation', 'won', 'lost')),
	CONSTRAINT "leads_channel_check" CHECK ("channel" IS NULL OR "channel" IN ('rfq', 'contact', 'demo'))
);
--> statement-breakpoint
CREATE TABLE "project"."license_activations" (
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
CREATE TABLE "project"."license_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_application_id" uuid NOT NULL,
	"api_key_id" text,
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
	CONSTRAINT "license_api_keys_status_check" CHECK ("status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "project"."license_applications" (
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
	CONSTRAINT "license_applications_source_check" CHECK ("source" IN ('third_party', 'own')),
	CONSTRAINT "license_applications_status_check" CHECK ("status" IN ('active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "project"."license_contracts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"customer_id" uuid,
	"company_id" uuid,
	"customer_name" text NOT NULL,
	"license_application_id" uuid NOT NULL,
	"package_name" varchar(200),
	"order_id" uuid,
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
CREATE TABLE "project"."license_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_key_id" uuid,
	"license_contract_id" uuid,
	"license_api_key_id" uuid,
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
CREATE TABLE "project"."license_keys" (
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
CREATE TABLE "project"."code_numberings" (
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
	CONSTRAINT "project_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "project_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "project"."settings" (
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
	CONSTRAINT "project_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "project"."projects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"order_id" uuid,
	"order_code" varchar(32) NOT NULL,
	"quotation_code" varchar(40),
	"customer_id" uuid,
	"company_id" uuid,
	"lead_id" uuid,
	"customer_name" text NOT NULL,
	"title" text NOT NULL,
	"site_name" varchar(200),
	"address_id" uuid,
	"contract_value" bigint DEFAULT 0 NOT NULL,
	"pic_user_id" text,
	"target_start_date" date,
	"target_end_date" date,
	"stage" text DEFAULT 'preparation' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"closed_by" text,
	"closed_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancel_reason" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "projects_status_check" CHECK ("status" IN ('active', 'closed', 'cancelled')),
	CONSTRAINT "projects_stage_check" CHECK (stage IN ('preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty')),
	CONSTRAINT "projects_contract_value_check" CHECK ("contract_value" >= 0),
	CONSTRAINT "projects_dates_check" CHECK ("target_end_date" IS NULL OR "target_start_date" IS NULL OR "target_end_date" >= "target_start_date")
);
--> statement-breakpoint
CREATE TABLE "project"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"stage" text NOT NULL,
	"assignee_user_id" text,
	"due_date" date,
	"status" text DEFAULT 'todo' NOT NULL,
	"done_by" text,
	"done_at" bigint,
	"created_by" text,
	"deleted_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tasks_status_check" CHECK ("status" IN ('todo', 'in_progress', 'done')),
	CONSTRAINT "tasks_stage_check" CHECK (stage IN ('preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty'))
);
--> statement-breakpoint
CREATE TABLE "project"."warranties" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(80) NOT NULL,
	"project_id" uuid NOT NULL,
	"handover_id" uuid NOT NULL,
	"customer_id" uuid,
	"company_id" uuid,
	"issue_date" date NOT NULL,
	"start_date" date NOT NULL,
	"months" integer DEFAULT 12 NOT NULL,
	"end_date" date NOT NULL,
	"product_summary" varchar(300) NOT NULL,
	"project_name" varchar(300) NOT NULL,
	"project_location" varchar(200),
	"project_owner" varchar(200) NOT NULL,
	"items" jsonb NOT NULL,
	"coverage" text NOT NULL,
	"exclusions" text NOT NULL,
	"service_terms" text NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "warranties_months_check" CHECK ("months" BETWEEN 1 AND 120),
	CONSTRAINT "warranties_dates_check" CHECK ("end_date" >= "start_date")
);
--> statement-breakpoint
CREATE INDEX "project_addresses_project_id_idx" ON "project"."addresses" ("project_id");--> statement-breakpoint
CREATE INDEX "costs_project_date_idx" ON "project"."costs" ("project_id","cost_date");--> statement-breakpoint
CREATE INDEX "evidence_project_kind_idx" ON "project"."evidence" ("project_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "handover_code_uq" ON "project"."handover" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "handover_project_id_idx" ON "project"."handover" ("project_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_id_idx" ON "project"."lead_activities" ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lead_attachments_lead_id_idx" ON "project"."lead_attachments" ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_owner_user_id_idx" ON "project"."leads" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "leads_company_id_idx" ON "project"."leads" ("company_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "project"."leads" ("status");--> statement-breakpoint
CREATE INDEX "leads_next_follow_up_at_idx" ON "project"."leads" ("next_follow_up_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_reference_uq" ON "project"."leads" ("reference") WHERE reference IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_idempotency_key_uq" ON "project"."leads" ("idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "license_activations_key_id_idx" ON "project"."license_activations" ("license_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_activations_active_uq" ON "project"."license_activations" ("license_key_id","instance_id") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_api_keys_application_id_idx" ON "project"."license_api_keys" ("license_application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_api_keys_api_key_id_uq" ON "project"."license_api_keys" ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_applications_code_uq" ON "project"."license_applications" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "license_contracts_code_uq" ON "project"."license_contracts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_contracts_customer_id_idx" ON "project"."license_contracts" ("customer_id");--> statement-breakpoint
CREATE INDEX "license_contracts_application_id_idx" ON "project"."license_contracts" ("license_application_id");--> statement-breakpoint
CREATE INDEX "license_contracts_status_idx" ON "project"."license_contracts" ("status");--> statement-breakpoint
CREATE INDEX "license_contracts_end_date_idx" ON "project"."license_contracts" ("end_date");--> statement-breakpoint
CREATE INDEX "license_events_key_id_idx" ON "project"."license_events" ("license_key_id");--> statement-breakpoint
CREATE INDEX "license_events_contract_id_idx" ON "project"."license_events" ("license_contract_id");--> statement-breakpoint
CREATE INDEX "license_events_event_at_idx" ON "project"."license_events" ("event_at");--> statement-breakpoint
CREATE UNIQUE INDEX "license_keys_key_uq" ON "project"."license_keys" ("license_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_keys_contract_id_idx" ON "project"."license_keys" ("license_contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_code_numberings_type_uq" ON "project"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_settings_scope_uq" ON "project"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_code_uq" ON "project"."projects" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_live_order_uq" ON "project"."projects" ("order_id") WHERE deleted_at IS NULL AND status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "projects_order_id_idx" ON "project"."projects" ("order_id");--> statement-breakpoint
CREATE INDEX "projects_customer_id_idx" ON "project"."projects" ("customer_id");--> statement-breakpoint
CREATE INDEX "projects_company_id_idx" ON "project"."projects" ("company_id");--> statement-breakpoint
CREATE INDEX "projects_lead_id_idx" ON "project"."projects" ("lead_id");--> statement-breakpoint
CREATE INDEX "projects_pic_user_id_idx" ON "project"."projects" ("pic_user_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "project"."projects" ("status");--> statement-breakpoint
CREATE INDEX "tasks_project_position_idx" ON "project"."tasks" ("project_id","position");--> statement-breakpoint
CREATE INDEX "tasks_assignee_user_id_idx" ON "project"."tasks" ("assignee_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warranties_code_uq" ON "project"."warranties" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warranties_live_project_uq" ON "project"."warranties" ("project_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warranties_customer_id_idx" ON "project"."warranties" ("customer_id");--> statement-breakpoint
CREATE INDEX "warranties_company_id_idx" ON "project"."warranties" ("company_id");--> statement-breakpoint
ALTER TABLE "project"."addresses" ADD CONSTRAINT "addresses_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"."projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project"."lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "project"."leads"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."lead_attachments" ADD CONSTRAINT "lead_attachments_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "project"."leads"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_activations" ADD CONSTRAINT "license_activations_license_key_id_license_keys_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "project"."license_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_api_keys" ADD CONSTRAINT "license_api_keys_49u0ClEK9joe_fkey" FOREIGN KEY ("license_application_id") REFERENCES "project"."license_applications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_contracts" ADD CONSTRAINT "license_contracts_UOXJOKioWjhY_fkey" FOREIGN KEY ("license_application_id") REFERENCES "project"."license_applications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_contracts" ADD CONSTRAINT "license_contracts_dhmyZryN6ou8_fkey" FOREIGN KEY ("renewed_from_contract_id") REFERENCES "project"."license_contracts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project"."license_events" ADD CONSTRAINT "license_events_license_key_id_license_keys_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "project"."license_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_events" ADD CONSTRAINT "license_events_license_contract_id_license_contracts_id_fkey" FOREIGN KEY ("license_contract_id") REFERENCES "project"."license_contracts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_events" ADD CONSTRAINT "license_events_license_api_key_id_license_api_keys_id_fkey" FOREIGN KEY ("license_api_key_id") REFERENCES "project"."license_api_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."license_keys" ADD CONSTRAINT "license_keys_license_contract_id_license_contracts_id_fkey" FOREIGN KEY ("license_contract_id") REFERENCES "project"."license_contracts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."projects" ADD CONSTRAINT "projects_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "project"."leads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project"."projects" ADD CONSTRAINT "projects_address_id_addresses_id_fkey" FOREIGN KEY ("address_id") REFERENCES "project"."addresses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project"."warranties" ADD CONSTRAINT "warranties_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"."projects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project"."warranties" ADD CONSTRAINT "warranties_handover_id_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "project"."handover"("id") ON DELETE RESTRICT;