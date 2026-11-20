CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "automation";
--> statement-breakpoint
CREATE SCHEMA "company";
--> statement-breakpoint
CREATE SCHEMA "customer";
--> statement-breakpoint
CREATE SCHEMA "document";
--> statement-breakpoint
CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE SCHEMA "human_resource";
--> statement-breakpoint
CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE SCHEMA "location";
--> statement-breakpoint
CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE SCHEMA "payment";
--> statement-breakpoint
CREATE SCHEMA "procurement";
--> statement-breakpoint
CREATE SCHEMA "project";
--> statement-breakpoint
CREATE SCHEMA "sale";
--> statement-breakpoint
CREATE SCHEMA "supplier";
--> statement-breakpoint
CREATE SCHEMA "tax";
--> statement-breakpoint
CREATE SCHEMA "ticket";
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" text PRIMARY KEY,
	"actor_user_id" text,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"organization_id" text,
	"meta" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."apikeys" (
	"id" text PRIMARY KEY,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"reference_id" text NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "auth"."invitations" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."members" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
	CONSTRAINT "organization_settings_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "auth"."organizations" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"description" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth"."passkeys" (
	"id" text PRIMARY KEY,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text
);
--> statement-breakpoint
CREATE TABLE "auth"."user_invitations" (
	"id" text PRIMARY KEY,
	"type" text DEFAULT 'app' NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"organization_id" text,
	"org_role" text,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"resent_count" integer DEFAULT 0 NOT NULL,
	"delivery_failed" boolean DEFAULT false NOT NULL,
	"claimed_at" bigint,
	"deleted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"bio" text,
	"username" text UNIQUE,
	"display_username" text,
	"deleted_at" timestamp,
	"status" text DEFAULT 'active',
	"claimed_at" timestamp,
	"phone" text,
	"gender" text,
	"birth_date" bigint,
	"birth_place" text,
	"marital_status" text,
	CONSTRAINT "users_gender_check" CHECK (gender IS NULL OR gender IN ('male', 'female')),
	CONSTRAINT "users_marital_status_check" CHECK (marital_status IS NULL OR marital_status IN ('single', 'married', 'divorced', 'widowed'))
);
--> statement-breakpoint
CREATE TABLE "auth"."verifications" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation"."faq_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"question" varchar(300) NOT NULL,
	"answer" text NOT NULL,
	"keywords" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "automation"."outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"topic" varchar(64) NOT NULL,
	"aggregate_type" varchar(64),
	"aggregate_id" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_attempt_at" bigint,
	"published_at" bigint,
	"response_status" smallint,
	"error_message" varchar(500),
	"dedupe_key" varchar(200),
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "outbox_messages_status_check" CHECK ("status" IN ('pending', 'published', 'failed')),
	CONSTRAINT "outbox_messages_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "automation"."whatsapp_conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"chat_id" varchar(128) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"contact_name" varchar(200),
	"status" text DEFAULT 'assistant' NOT NULL,
	"handoff_reason" text,
	"handoff_at" bigint,
	"assigned_user_id" text,
	"lead_id" uuid,
	"last_message_at" bigint NOT NULL,
	"last_inbound_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "whatsapp_conversations_status_check" CHECK ("status" IN ('assistant', 'handoff', 'closed')),
	CONSTRAINT "whatsapp_conversations_handoff_reason_check" CHECK ("handoff_reason" IS NULL OR "handoff_reason" IN ('no_provider', 'not_found', 'human_requested', 'restricted', 'error'))
);
--> statement-breakpoint
CREATE TABLE "automation"."whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"author" text NOT NULL,
	"external_id" varchar(128),
	"body" text NOT NULL,
	"status" text NOT NULL,
	"faq_entry_id" uuid,
	"sent_by" text,
	"error_message" varchar(500),
	"attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "whatsapp_messages_direction_check" CHECK ("direction" IN ('inbound', 'outbound')),
	CONSTRAINT "whatsapp_messages_author_check" CHECK ("author" IN ('customer', 'assistant', 'admin', 'system')),
	CONSTRAINT "whatsapp_messages_status_check" CHECK ("status" IN ('received', 'processed', 'pending', 'sent', 'failed')),
	CONSTRAINT "whatsapp_messages_attempts_check" CHECK ("attempts" >= 0)
);
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
	"whatsapp" varchar(30),
	"website" varchar(200),
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" text,
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
	"email" text,
	"phone" varchar(30),
	"whatsapp" varchar(30),
	"is_primary" boolean DEFAULT false NOT NULL,
	"customer_type" text DEFAULT 'individual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" text,
	"user_id" text,
	"portal_role" text,
	"portal_status" text,
	"portal_invited_by" text,
	"portal_last_login_at" bigint,
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
CREATE TABLE "document"."access_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"accessed_by_user_id" text,
	"action" text NOT NULL,
	"accessed_at" bigint NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "access_logs_action_check" CHECK ("action" IN ('view', 'download', 'print', 'share', 'delete', 'pdf_sign'))
);
--> statement-breakpoint
CREATE TABLE "document"."code_numberings" (
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
	CONSTRAINT "document_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "document_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "document"."files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"checksum" text,
	"uploaded_by_user_id" text,
	"uploaded_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "files_size_bytes_check" CHECK ("size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document"."settings" (
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
	CONSTRAINT "document_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "document"."shares" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"share_type" text NOT NULL,
	"token" uuid,
	"shared_with_type" text,
	"shared_with_id" text,
	"shared_by_user_id" text,
	"shared_at" bigint NOT NULL,
	"expires_at" bigint,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "shares_share_type_check" CHECK ("share_type" IN ('internal', 'customer', 'portal', 'public_link'))
);
--> statement-breakpoint
CREATE TABLE "document"."signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"requested_by_user_id" text,
	"signer_user_id" text,
	"signer_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"decline_reason" text,
	"expires_at" bigint,
	"responded_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "signature_requests_status_check" CHECK ("status" IN ('pending', 'signed', 'declined', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "document"."signatures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"signer_type" text NOT NULL,
	"signer_user_id" text,
	"signer_name" text NOT NULL,
	"signed_at" bigint NOT NULL,
	"signature_method" text DEFAULT 'electronic' NOT NULL,
	"ip_address" text,
	"certificate_serial" text,
	"signature_image_key" text,
	"source_file_id" uuid,
	"signed_file_key" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "signatures_signer_type_check" CHECK ("signer_type" IN ('internal', 'customer', 'partner')),
	CONSTRAINT "signatures_signature_method_check" CHECK ("signature_method" IN ('electronic', 'wet_ink', 'stamp'))
);
--> statement-breakpoint
CREATE TABLE "document"."tag_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"document_tag_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "document"."tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tag" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "document"."templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"module" text,
	"version" integer DEFAULT 1 NOT NULL,
	"content_template" text,
	"numbering_pattern" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "templates_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "document"."user_signatures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"user_id" text,
	"object_key" text NOT NULL,
	"uploaded_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "document"."documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"document_type" text NOT NULL,
	"title" text NOT NULL,
	"template_id" uuid,
	"module" text,
	"source_type" text,
	"source_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"issued_on" date,
	"issued_by_user_id" text,
	"approved_by_user_id" text,
	"approved_at" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"supersedes_document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "documents_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'issued', 'void', 'expired', 'archived')),
	CONSTRAINT "documents_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."account_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"account_id" uuid NOT NULL,
	"accounting_period_id" uuid NOT NULL,
	"balance_date" date NOT NULL,
	"debit_total" bigint DEFAULT 0 NOT NULL,
	"credit_total" bigint DEFAULT 0 NOT NULL,
	"closing_balance" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"calculated_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "account_balances_debit_check" CHECK (debit_total >= 0),
	CONSTRAINT "account_balances_credit_check" CHECK (credit_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_by" text,
	"closed_at" bigint,
	"reopened_by" text,
	"reopened_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "accounting_periods_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "accounting_periods_range_check" CHECK (end_date >= start_date),
	CONSTRAINT "accounting_periods_status_check" CHECK (status IN ('open', 'closed', 'locked'))
);
--> statement-breakpoint
CREATE TABLE "finance"."ap_open_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"supplier_bill_id" uuid NOT NULL,
	"supplier_company_id" uuid,
	"bill_date" date,
	"due_date" date,
	"original_amount" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"outstanding_amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "ap_open_items_status_check" CHECK (status IN ('open', 'partially_paid', 'paid', 'void')),
	CONSTRAINT "ap_open_items_original_check" CHECK (original_amount >= 0),
	CONSTRAINT "ap_open_items_paid_check" CHECK (paid_amount >= 0),
	CONSTRAINT "ap_open_items_outstanding_check" CHECK (outstanding_amount >= 0),
	CONSTRAINT "ap_open_items_consistency_check" CHECK (outstanding_amount = original_amount - paid_amount)
);
--> statement-breakpoint
CREATE TABLE "finance"."ar_open_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"invoice_id" uuid,
	"customer_id" uuid,
	"invoice_date" date,
	"due_date" date,
	"original_amount" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"outstanding_amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "ar_open_items_status_check" CHECK (status IN ('open', 'partially_paid', 'paid', 'void')),
	CONSTRAINT "ar_open_items_original_check" CHECK (original_amount >= 0),
	CONSTRAINT "ar_open_items_paid_check" CHECK (paid_amount >= 0),
	CONSTRAINT "ar_open_items_outstanding_check" CHECK (outstanding_amount >= 0),
	CONSTRAINT "ar_open_items_consistency_check" CHECK (outstanding_amount = original_amount - paid_amount)
);
--> statement-breakpoint
CREATE TABLE "finance"."asset_depreciations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"depreciation_amount" bigint DEFAULT 0 NOT NULL,
	"opening_book_value" bigint DEFAULT 0 NOT NULL,
	"closing_book_value" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"calculated_at" bigint,
	"journal_entry_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "asset_depreciations_period_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "asset_depreciations_method_check" CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "asset_depreciations_amount_check" CHECK (depreciation_amount >= 0),
	CONSTRAINT "asset_depreciations_closing_check" CHECK (closing_book_value >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_account_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"cash_bank_account_id" uuid NOT NULL,
	"chart_of_account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"bank_reconciliation_id" uuid NOT NULL,
	"cash_bank_transaction_id" uuid,
	"statement_reference" text,
	"statement_amount" bigint,
	"is_matched" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"cash_bank_account_id" uuid NOT NULL,
	"reconciliation_date" date NOT NULL,
	"statement_balance" bigint DEFAULT 0 NOT NULL,
	"book_balance" bigint DEFAULT 0 NOT NULL,
	"difference" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reconciled_by" text,
	"reconciled_at" bigint,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "bank_reconciliations_status_check" CHECK (status IN ('draft', 'in_progress', 'reconciled', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "finance"."cash_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"account_type" text DEFAULT 'bank' NOT NULL,
	"bank_name" text,
	"bank_code" varchar(20),
	"branch_name" varchar(100),
	"account_number" text,
	"account_holder" text,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"current_balance" bigint DEFAULT 0 NOT NULL,
	"invoice_usage" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "cash_bank_accounts_type_check" CHECK (account_type IN ('cash', 'bank', 'ewallet', 'clearing')),
	CONSTRAINT "cash_bank_accounts_opening_check" CHECK (opening_balance >= 0),
	CONSTRAINT "cash_bank_accounts_invoice_usage_check" CHECK (invoice_usage IS NULL OR invoice_usage IN ('vat', 'non_vat'))
);
--> statement-breakpoint
CREATE TABLE "finance"."cash_bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"cash_bank_account_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"source_type" text,
	"source_id" text,
	"description" text,
	"reference_number" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"balance_after" bigint DEFAULT 0 NOT NULL,
	"posted_by" text,
	"posted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "cash_bank_transactions_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "cash_bank_transactions_amount_check" CHECK (amount > 0),
	CONSTRAINT "cash_bank_transactions_status_check" CHECK (status IN ('draft', 'posted', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "finance"."chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"normal_balance" text DEFAULT 'debit' NOT NULL,
	"parent_account_id" uuid,
	"level" integer DEFAULT 1 NOT NULL,
	"is_postable" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"cash_flow_category" text,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "chart_of_accounts_type_check" CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
	CONSTRAINT "chart_of_accounts_normal_balance_check" CHECK (normal_balance IN ('debit', 'credit')),
	CONSTRAINT "chart_of_accounts_cash_flow_category_check" CHECK (cash_flow_category IS NULL OR cash_flow_category IN ('operating', 'investing', 'financing')),
	CONSTRAINT "chart_of_accounts_level_check" CHECK (level >= 1)
);
--> statement-breakpoint
CREATE TABLE "finance"."code_numberings" (
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
	CONSTRAINT "finance_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "finance_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "finance"."journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"accounting_period_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"description" text,
	"source_type" text,
	"source_id" text,
	"idempotency_key" text,
	"source_module" text DEFAULT 'finance' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_debit" bigint DEFAULT 0 NOT NULL,
	"total_credit" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"prepared_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"posted_by" text,
	"posted_at" bigint,
	"reversed_by_entry_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "journal_entries_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'posted', 'reversed', 'void')),
	CONSTRAINT "journal_entries_total_debit_check" CHECK (total_debit >= 0),
	CONSTRAINT "journal_entries_total_credit_check" CHECK (total_credit >= 0),
	CONSTRAINT "journal_entries_balanced_check" CHECK (total_debit = total_credit),
	CONSTRAINT "journal_entries_source_module_check" CHECK (source_module IN ('finance', 'sale', 'procurement', 'inventory', 'payment', 'tax', 'human_resource'))
);
--> statement-breakpoint
CREATE TABLE "finance"."journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"journal_entry_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"cost_center_id" uuid,
	"project_id" uuid,
	"party_type" text,
	"party_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "journal_lines_debit_check" CHECK (debit >= 0),
	CONSTRAINT "journal_lines_credit_check" CHECK (credit >= 0),
	CONSTRAINT "journal_lines_one_side_check" CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
--> statement-breakpoint
CREATE TABLE "finance"."opening_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"account_id" uuid NOT NULL,
	"as_of_date" date NOT NULL,
	"debit_balance" bigint DEFAULT 0 NOT NULL,
	"credit_balance" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"posted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "opening_balances_debit_check" CHECK (debit_balance >= 0),
	CONSTRAINT "opening_balances_credit_check" CHECK (credit_balance >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"discount_percent" numeric(5,2),
	"discount_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payment_terms_days_check" CHECK (days >= 0),
	CONSTRAINT "payment_terms_discount_check" CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100))
);
--> statement-breakpoint
CREATE TABLE "finance"."report_archives" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"report_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_by" text,
	"generated_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "report_archives_month_check" CHECK (period_month BETWEEN 1 AND 12),
	CONSTRAINT "report_archives_type_check" CHECK (report_type IN ('profit_and_loss', 'balance_sheet', 'cash_flow'))
);
--> statement-breakpoint
CREATE TABLE "finance"."supplier_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"supplier_bill_id" uuid NOT NULL,
	"purchase_order_item_id" uuid,
	"product_id" uuid,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"tax_base" bigint DEFAULT 0 NOT NULL,
	"is_stock" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_bill_items_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "supplier_bill_items_amounts_check" CHECK (unit_price >= 0 AND line_total >= 0 AND tax_base >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."supplier_bills" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"supplier_company_id" uuid,
	"purchase_order_id" uuid,
	"supplier_invoice_number" varchar(100),
	"bill_date" date,
	"due_date" date,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"paid_total" bigint DEFAULT 0 NOT NULL,
	"outstanding_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_bills_status_check" CHECK (status IN ('draft', 'approved', 'partially_paid', 'paid', 'overdue', 'void')),
	CONSTRAINT "supplier_bills_subtotal_check" CHECK (subtotal >= 0),
	CONSTRAINT "supplier_bills_tax_total_check" CHECK (tax_total >= 0),
	CONSTRAINT "supplier_bills_grand_total_check" CHECK (grand_total >= 0),
	CONSTRAINT "supplier_bills_paid_total_check" CHECK (paid_total >= 0),
	CONSTRAINT "supplier_bills_outstanding_total_check" CHECK (outstanding_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."attendances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"status" text NOT NULL,
	"check_in_at" bigint,
	"check_out_at" bigint,
	"source" text DEFAULT 'manual' NOT NULL,
	"leave_request_id" uuid,
	"notes" text,
	"recorded_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "attendances_status_check" CHECK (status IN ('present', 'permit', 'sick', 'leave', 'absent', 'holiday')),
	CONSTRAINT "attendances_source_check" CHECK (source IN ('manual', 'import', 'leave')),
	CONSTRAINT "attendances_times_check" CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employee_salaries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"base_salary" bigint DEFAULT 0 NOT NULL,
	"fixed_allowances" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"bank_name" varchar(100),
	"bank_account_number" varchar(50),
	"bank_account_holder" varchar(200),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_salaries_base_check" CHECK (base_salary >= 0),
	CONSTRAINT "employee_salaries_allowances_check" CHECK (fixed_allowances >= 0),
	CONSTRAINT "employee_salaries_range_check" CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employee_salary_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"period" varchar(7) NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_name" text NOT NULL,
	"base_salary" bigint DEFAULT 0 NOT NULL,
	"allowances" bigint DEFAULT 0 NOT NULL,
	"overtime_pay" bigint DEFAULT 0 NOT NULL,
	"bonus" bigint DEFAULT 0 NOT NULL,
	"deductions" bigint DEFAULT 0 NOT NULL,
	"net_pay" bigint NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_salary_records_status_check" CHECK (status IN ('draft', 'approved')),
	CONSTRAINT "employee_salary_records_amounts_check" CHECK (base_salary >= 0 AND allowances >= 0 AND overtime_pay >= 0 AND bonus >= 0 AND deductions >= 0),
	CONSTRAINT "employee_salary_records_net_check" CHECK (net_pay = base_salary + allowances + overtime_pay + bonus - deductions)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employee_tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"done_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_tasks_status_check" CHECK (status IN ('open', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employees" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"user_id" text,
	"employee_code" varchar(32) NOT NULL,
	"full_name" text NOT NULL,
	"legal_name" text,
	"nickname" text,
	"national_id" varchar(32),
	"email" varchar(320),
	"phone" varchar(100),
	"whatsapp" varchar(100),
	"photo_object_key" text,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"employment_type" text DEFAULT 'permanent' NOT NULL,
	"work_type" text DEFAULT 'onsite' NOT NULL,
	"hire_date" bigint,
	"termination_date" bigint,
	"manager_employee_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employees_employment_status_check" CHECK (employment_status IN ('active', 'inactive', 'terminated')),
	CONSTRAINT "employees_employment_type_check" CHECK (employment_type IN ('permanent', 'contract', 'probation', 'internship', 'outsourced')),
	CONSTRAINT "employees_work_type_check" CHECK (work_type IN ('onsite', 'remote', 'hybrid')),
	CONSTRAINT "employees_termination_check" CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."code_numberings" (
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
	CONSTRAINT "human_resource_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "human_resource_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."settings" (
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
	CONSTRAINT "human_resource_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "human_resource"."leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"recorded_by" text,
	"decided_by" text,
	"decided_at" bigint,
	"decision_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "leave_requests_status_check" CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "leave_requests_dates_check" CHECK (end_date >= start_date),
	CONSTRAINT "leave_requests_days_check" CHECK (days > 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."leave_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"attendance_status" text DEFAULT 'leave' NOT NULL,
	"uses_quota" boolean DEFAULT false NOT NULL,
	"annual_quota_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "leave_types_attendance_status_check" CHECK (attendance_status IN ('leave', 'sick', 'permit')),
	CONSTRAINT "leave_types_quota_check" CHECK (annual_quota_days >= 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."overtime_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"hours" numeric(5,2) NOT NULL,
	"reason" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"recorded_by" text,
	"decided_by" text,
	"decided_at" bigint,
	"decision_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "overtime_requests_status_check" CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "overtime_requests_hours_check" CHECK (hours > 0 AND hours <= 24)
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_id" uuid NOT NULL,
	"borrowing_item_id" uuid,
	"event_type" text NOT NULL,
	"movement_id" uuid,
	"actor_user_id" text,
	"occurred_at" bigint NOT NULL,
	"note" text,
	CONSTRAINT "borrowing_events_type_check" CHECK (event_type IN ('issued', 'returned', 'marked_late', 'marked_lost', 'due_date_extended', 'closed')),
	CONSTRAINT "borrowing_events_movement_check" CHECK ((event_type IN ('issued', 'returned', 'marked_lost') AND movement_id IS NOT NULL)
				OR (event_type NOT IN ('issued', 'returned', 'marked_lost') AND movement_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"borrowing_request_id" uuid NOT NULL,
	"borrowing_id" uuid,
	"item_id" uuid NOT NULL,
	"origin_warehouse_id" uuid,
	"origin_storage_id" uuid,
	"issued_at" bigint,
	"due_at" bigint,
	"returned_at" bigint,
	"returned_condition" text,
	"marked_late_at" bigint,
	"marked_lost_at" bigint,
	"lost_reported_by" text,
	"site_address_text" text,
	"project_id" uuid,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowing_items_condition_check" CHECK (returned_condition IS NULL OR returned_condition IN ('good', 'damaged', 'incomplete')),
	CONSTRAINT "borrowing_items_due_after_issue_check" CHECK (due_at IS NULL OR issued_at IS NULL OR due_at > issued_at),
	CONSTRAINT "borrowing_items_origin_storage_check" CHECK (origin_storage_id IS NULL OR origin_warehouse_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_request_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_request_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" text,
	"occurred_at" bigint NOT NULL,
	"note" text,
	CONSTRAINT "borrowing_request_events_type_check" CHECK (event_type IN ('requested', 'approved', 'rejected', 'cancelled', 'due_date_extended'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"purpose" text DEFAULT 'internal_use' NOT NULL,
	"borrower_type" text NOT NULL,
	"tool_set_id" uuid,
	"borrower_user_id" text,
	"borrower_customer_id" uuid,
	"guest_name" text,
	"guest_phone" text,
	"guest_id_type" text,
	"guest_id_number" text,
	"guest_address_text" text,
	"guest_id_document_ref" text,
	"requested_by" text,
	"requested_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"due_at" bigint NOT NULL,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowing_requests_status_check" CHECK (status IN ('draft', 'requested', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "borrowing_requests_purpose_check" CHECK (purpose IN ('rental', 'internal_use', 'testing', 'warranty_service')),
	CONSTRAINT "borrowing_requests_borrower_type_check" CHECK (borrower_type IN ('user', 'customer', 'guest')),
	CONSTRAINT "borrowing_requests_guest_id_type_check" CHECK (guest_id_type IS NULL OR guest_id_type IN ('ktp', 'sim', 'passport', 'other')),
	CONSTRAINT "borrowing_requests_borrower_identity_check" CHECK ((borrower_type = 'user' AND borrower_user_id IS NOT NULL AND borrower_customer_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'customer' AND borrower_customer_id IS NOT NULL AND borrower_user_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'guest' AND guest_name IS NOT NULL AND guest_phone IS NOT NULL AND guest_id_number IS NOT NULL AND borrower_user_id IS NULL AND borrower_customer_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"borrowing_request_id" uuid NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"issued_by" text,
	"issued_at" bigint,
	"due_at" bigint NOT NULL,
	"closed_by" text,
	"closed_at" bigint,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowings_status_check" CHECK (status IN ('issued', 'partially_returned', 'returned', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."condition_checks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid NOT NULL,
	"check_date" date NOT NULL,
	"condition" text NOT NULL,
	"findings" text,
	"checked_by_user_id" text,
	"next_check_date" date,
	"status" text DEFAULT 'recorded' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "condition_checks_condition_check" CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
	CONSTRAINT "condition_checks_status_check" CHECK (status IN ('recorded', 'followed_up', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."disposals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"item_id" uuid NOT NULL,
	"disposal_date" date,
	"disposal_method" text DEFAULT 'scrap' NOT NULL,
	"proceeds_amount" bigint DEFAULT 0 NOT NULL,
	"book_value_at_disposal" bigint DEFAULT 0 NOT NULL,
	"gain_loss" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"buyer_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"requested_by" text,
	"approved_by" text,
	"approved_at" bigint,
	"executed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "disposals_method_check" CHECK (disposal_method IN ('sale', 'scrap', 'donation', 'transfer', 'trade_in')),
	CONSTRAINT "disposals_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'executed', 'cancelled')),
	CONSTRAINT "disposals_proceeds_check" CHECK (proceeds_amount >= 0),
	CONSTRAINT "disposals_book_value_check" CHECK (book_value_at_disposal >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."code_numberings" (
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
	CONSTRAINT "inventory_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "inventory_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"product_id" uuid,
	"item_id" uuid,
	"document_type" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "inventory_documents_type_check" CHECK (document_type IN ('photo', 'manual', 'datasheet', 'certificate', 'invoice', 'contract')),
	CONSTRAINT "inventory_documents_owner_check" CHECK ((product_id IS NOT NULL AND item_id IS NULL) OR (product_id IS NULL AND item_id IS NOT NULL)),
	CONSTRAINT "inventory_documents_size_check" CHECK (size_bytes >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "inventory_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."item_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"parent_category_id" uuid,
	"item_kind" text DEFAULT 'equipment' NOT NULL,
	"default_useful_life_months" integer,
	"default_depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "item_categories_dep_method_check" CHECK (default_depreciation_method IN ('straight_line', 'declining_balance', 'none'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."item_serials" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"product_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"is_provisional_serial" boolean DEFAULT false NOT NULL,
	"asset_tag" text,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"acquired_on" date,
	"warranty_expires_on" date,
	"purchase_order_line_id" uuid,
	"customer_id" uuid,
	"company_id" uuid,
	"movement_id" uuid,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "item_serials_status_check" CHECK (status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged')),
	CONSTRAINT "item_serials_provisional_check" CHECK (is_provisional_serial = false OR status = 'pre_order'),
	CONSTRAINT "item_serials_warranty_check" CHECK (warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on)
);
--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"item_kind" text DEFAULT 'equipment' NOT NULL,
	"item_category_id" uuid,
	"serial_number" text,
	"barcode" text,
	"acquisition_date" date,
	"acquisition_cost" bigint DEFAULT 0 NOT NULL,
	"salvage_value" bigint DEFAULT 0 NOT NULL,
	"accumulated_depreciation" bigint DEFAULT 0 NOT NULL,
	"book_value" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"useful_life_months" integer,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"depreciation_started_on" date,
	"condition" text DEFAULT 'good' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"deactivation_reason" text,
	"location_description" text,
	"warehouse_id" uuid,
	"storage_id" uuid,
	"custodian_employee_id" uuid,
	"borrowed_since" bigint,
	"supplier_company_id" uuid,
	"purchase_order_id" uuid,
	"document_id" uuid,
	"image_url" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "items_status_check" CHECK (status IN ('ready', 'borrowed', 'maintenance', 'inactive', 'disposed', 'lost')),
	CONSTRAINT "items_condition_check" CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
	CONSTRAINT "items_dep_method_check" CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "items_acquisition_cost_check" CHECK (acquisition_cost >= 0),
	CONSTRAINT "items_salvage_value_check" CHECK (salvage_value >= 0),
	CONSTRAINT "items_accumulated_depreciation_check" CHECK (accumulated_depreciation >= 0),
	CONSTRAINT "items_book_value_check" CHECK (book_value >= 0),
	CONSTRAINT "items_useful_life_check" CHECK (useful_life_months IS NULL OR useful_life_months > 0),
	CONSTRAINT "items_deactivation_reason_check" CHECK ((status = 'inactive' AND deactivation_reason IS NOT NULL) OR (status <> 'inactive' AND deactivation_reason IS NULL)),
	CONSTRAINT "items_storage_requires_warehouse_check" CHECK (storage_id IS NULL OR warehouse_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "inventory"."maintenances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"item_id" uuid NOT NULL,
	"maintenance_type" text DEFAULT 'preventive' NOT NULL,
	"scheduled_date" date,
	"performed_date" date,
	"performed_by_employee_id" uuid,
	"vendor_name" text,
	"cost" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"next_service_date" date,
	"document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "maintenances_type_check" CHECK (maintenance_type IN ('preventive', 'corrective', 'calibration', 'inspection')),
	CONSTRAINT "maintenances_status_check" CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "maintenances_cost_check" CHECK (cost >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"movement_type" text NOT NULL,
	"product_id" uuid,
	"item_id" uuid,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"target_warehouse_id" uuid,
	"target_bin_id" uuid,
	"from_location" text,
	"to_location" text,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"occurred_at" bigint NOT NULL,
	"created_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "movements_type_check" CHECK (movement_type IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'consumption', 'borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost')),
	CONSTRAINT "movements_status_check" CHECK (status IN ('draft', 'posted', 'reversed')),
	CONSTRAINT "movements_quantity_check" CHECK (quantity <> 0),
	CONSTRAINT "movements_owner_check" CHECK ((product_id IS NOT NULL AND item_id IS NULL) OR (product_id IS NULL AND item_id IS NOT NULL)),
	CONSTRAINT "movements_transfer_target_check" CHECK ((movement_type IN ('transfer_in', 'transfer_out') AND target_warehouse_id IS NOT NULL) OR (movement_type NOT IN ('transfer_in', 'transfer_out'))),
	CONSTRAINT "movements_item_type_check" CHECK ((movement_type IN ('borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost') AND item_id IS NOT NULL) OR (movement_type NOT IN ('borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost')))
);
--> statement-breakpoint
CREATE TABLE "inventory"."product_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"short_name" varchar(60),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"serial_number" text,
	"name" text NOT NULL,
	"description" text,
	"product_kind" text NOT NULL,
	"product_category_id" uuid,
	"brand" varchar(100),
	"specification" text,
	"image_object_key" text,
	"unit_label" varchar(32) DEFAULT 'pcs' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_serialized" boolean DEFAULT false NOT NULL,
	"is_stock_tracked" boolean DEFAULT true NOT NULL,
	"min_stock_qty" numeric(18,3) DEFAULT '0' NOT NULL,
	"barcode" text,
	"selling_price" bigint DEFAULT 0 NOT NULL,
	"purchase_price" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"slug" varchar(120),
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" bigint,
	"listing_specs" varchar(400),
	"price_mode" text DEFAULT 'list' NOT NULL,
	"price_caption" varchar(120),
	"out_of_stock_mode" text DEFAULT 'request' NOT NULL,
	"lead_time_label" varchar(60),
	"applications" jsonb DEFAULT '[]' NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "products_kind_check" CHECK (product_kind IN ('product', 'component', 'material')),
	CONSTRAINT "products_prices_check" CHECK (selling_price >= 0 AND purchase_price >= 0),
	CONSTRAINT "products_min_stock_check" CHECK (min_stock_qty >= 0),
	CONSTRAINT "products_unit_label_check" CHECK (unit_label IN ('pcs', 'unit', 'set', 'paket', 'titik', 'm', 'roll', 'kg', 'jam', 'bulan', 'tahun', 'lic', 'lot', 'pulau')),
	CONSTRAINT "products_price_mode_check" CHECK (price_mode IN ('list', 'rfq')),
	CONSTRAINT "products_out_of_stock_mode_check" CHECK (out_of_stock_mode IN ('out', 'preorder', 'request')),
	CONSTRAINT "products_popularity_check" CHECK (popularity >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_adjustment_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"stock_adjustment_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity_before" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_after" numeric(18,3) DEFAULT '0' NOT NULL,
	"unit_cost" bigint,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "stock_adjustment_items_before_check" CHECK (quantity_before >= 0),
	CONSTRAINT "stock_adjustment_items_after_check" CHECK (quantity_after >= 0),
	CONSTRAINT "stock_adjustment_items_unit_cost_check" CHECK (unit_cost IS NULL OR unit_cost >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"adjustment_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reason_code" text,
	"notes" text,
	"requested_by" text,
	"requested_at" bigint NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"posted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "stock_adjustments_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled')),
	CONSTRAINT "stock_adjustments_type_check" CHECK (adjustment_type IN ('increase', 'decrease', 'recount')),
	CONSTRAINT "stock_adjustments_approval_check" CHECK ((status NOT IN ('approved', 'posted') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))),
	CONSTRAINT "stock_adjustments_posted_check" CHECK ((status <> 'posted' OR posted_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."stocks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity_on_hand" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_reserved" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_available" numeric(18,3) DEFAULT '0' NOT NULL,
	"average_cost" bigint DEFAULT 0 NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"last_movement_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "stocks_available_check" CHECK (quantity_available = quantity_on_hand - quantity_reserved),
	CONSTRAINT "stocks_on_hand_check" CHECK (quantity_on_hand >= 0),
	CONSTRAINT "stocks_reserved_check" CHECK (quantity_reserved >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."tool_set_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tool_set_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "tool_set_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."tool_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"custodian_employee_id" uuid,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "tool_sets_status_check" CHECK (status IN ('available', 'lent', 'maintenance', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"label" text,
	"address_line" text NOT NULL,
	"rt" varchar(8),
	"rw" varchar(8),
	"postal_code" varchar(10),
	"village_id" uuid,
	"latitude" numeric(10,7),
	"longitude" numeric(10,7),
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_managers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"user_id" text,
	"assigned_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"organization_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "warehouse_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_storages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text,
	"bin_type" text,
	"capacity" numeric(18,3),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"responsible_employee_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "location"."districts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	"regency_id" uuid
);
--> statement-breakpoint
CREATE TABLE "location"."provinces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "location"."regencies" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	"province_id" uuid
);
--> statement-breakpoint
CREATE TABLE "location"."villages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	"district_id" uuid
);
--> statement-breakpoint
CREATE TABLE "notification"."push_notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"variables" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "push_push_notification_templates_channel_check" CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook'))
);
--> statement-breakpoint
CREATE TABLE "notification"."push_notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"notification_template_id" uuid,
	"user_id" text,
	"template_code" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"variables" jsonb,
	"metadata" jsonb,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" bigint,
	"read_at" bigint,
	"source_type" text,
	"source_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "push_notifications_channel_check" CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook')),
	CONSTRAINT "push_notifications_status_check" CHECK ("status" IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "payment"."gateways" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"provider" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'sandbox' NOT NULL,
	"config" jsonb,
	"secret_ciphertext" text,
	"secret_iv" text,
	"secret_tag" text,
	"secret_last4" varchar(4),
	"key_version" smallint DEFAULT 1 NOT NULL,
	"webhook_token_ciphertext" text,
	"webhook_token_iv" text,
	"webhook_token_tag" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"rotated_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "gateways_provider_check" CHECK (provider IN ('xendit', 'singapay', 'fake')),
	CONSTRAINT "gateways_mode_check" CHECK (mode IN ('sandbox', 'live')),
	CONSTRAINT "gateways_key_version_check" CHECK (key_version > 0)
);
--> statement-breakpoint
CREATE TABLE "payment"."payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"payment_id" uuid NOT NULL,
	"payable_type" text NOT NULL,
	"payable_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"allocated_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payment_allocations_payable_type_check" CHECK (payable_type IN ('sale_invoice', 'supplier_bill', 'employee_advance', 'expense_claim', 'expense_settlement', 'employee_salary_record')),
	CONSTRAINT "payment_allocations_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "payment"."code_numberings" (
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
	CONSTRAINT "payment_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "payment_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "payment"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "payment"."payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"payment_type" text NOT NULL,
	"direction" text NOT NULL,
	"channel" text DEFAULT 'manual' NOT NULL,
	"gateway_id" uuid,
	"provider" text,
	"provider_reference" varchar(100),
	"payment_url" text,
	"expires_at" bigint,
	"paid_at" bigint,
	"paid_amount" bigint,
	"payment_channel" text,
	"provider_transaction_id" varchar(100),
	"receipt_id" uuid,
	"settlement_note" text,
	"last_event" jsonb,
	"counterparty_type" text,
	"counterparty_id" text,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"payment_method" text DEFAULT 'bank_transfer' NOT NULL,
	"payment_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"requested_by" text,
	"requested_at" bigint,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"executed_by" text,
	"executed_at" bigint,
	"cash_bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payments_type_check" CHECK (payment_type IN ('receipt', 'disbursement', 'refund', 'advance_disbursement', 'payroll', 'profit_distribution', 'investment')),
	CONSTRAINT "payments_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "payments_channel_check" CHECK (channel IN ('manual', 'gateway')),
	CONSTRAINT "payments_provider_check" CHECK (provider IS NULL OR provider IN ('xendit', 'singapay', 'fake')),
	CONSTRAINT "payments_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'executed', 'pending', 'paid', 'expired', 'failed', 'reversed', 'void', 'cancelled')),
	CONSTRAINT "payments_amount_check" CHECK (amount > 0),
	CONSTRAINT "payments_paid_amount_check" CHECK (paid_amount IS NULL OR paid_amount >= 0),
	CONSTRAINT "payments_method_check" CHECK (payment_method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque', 'offset'))
);
--> statement-breakpoint
CREATE TABLE "procurement"."goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"movement_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "goods_receipt_items_amounts_check" CHECK (quantity > 0 AND unit_cost >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"status" text DEFAULT 'posted' NOT NULL,
	"receipt_date" date NOT NULL,
	"supplier_delivery_ref" varchar(100),
	"received_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "goods_receipts_status_check" CHECK (status IN ('posted'))
);
--> statement-breakpoint
CREATE TABLE "procurement"."code_numberings" (
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
	CONSTRAINT "procurement_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "procurement_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"quantity_received" numeric(18,3) DEFAULT '0' NOT NULL,
	"purchase_request_item_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_order_items_amounts_check" CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0 AND quantity_received >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40),
	"supplier_company_id" uuid,
	"supplier_pic_id" uuid,
	"supplier_snapshot" jsonb NOT NULL,
	"category" text NOT NULL,
	"subject" varchar(200) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"supplier_quote_ref" varchar(100),
	"supplier_quote_date" date,
	"project_name" varchar(200),
	"buyer_pic_name" varchar(120),
	"vat_mode" text DEFAULT 'none' NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"payment_terms" varchar(500),
	"terms" text,
	"notes" text,
	"rejection_reason" text,
	"created_by" text,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"sent_by" text,
	"sent_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_orders_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'sent', 'partially_received', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_category_check" CHECK (category IN ('hardware', 'software', 'service', 'other')),
	CONSTRAINT "purchase_orders_vat_mode_check" CHECK (vat_mode IN ('none', 'included', 'added')),
	CONSTRAINT "purchase_orders_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000),
	CONSTRAINT "purchase_orders_amounts_check" CHECK (subtotal >= 0 AND tax_total >= 0 AND grand_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_request_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_request_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"estimated_unit_price" bigint DEFAULT 0 NOT NULL,
	"estimated_total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_request_items_amounts_check" CHECK (quantity > 0 AND estimated_unit_price >= 0 AND estimated_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40),
	"organization_id" text,
	"requested_by" text,
	"requested_by_name" varchar(120),
	"subject" varchar(200) NOT NULL,
	"justification" text,
	"project_name" varchar(200),
	"request_date" date NOT NULL,
	"needed_by" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"estimated_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"rejection_reason" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_requests_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'ordered', 'cancelled')),
	CONSTRAINT "purchase_requests_estimated_total_check" CHECK (estimated_total >= 0),
	CONSTRAINT "purchase_requests_needed_by_check" CHECK (needed_by IS NULL OR needed_by >= request_date)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_return_id" uuid NOT NULL,
	"goods_receipt_item_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_return_items_amounts_check" CHECK (quantity > 0 AND unit_cost >= 0 AND line_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32),
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_company_id" uuid,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"return_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"rejection_reason" text,
	"created_by" text,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"shipped_by" text,
	"shipped_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_returns_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'shipped', 'cancelled')),
	CONSTRAINT "purchase_returns_total_check" CHECK (total_amount >= 0)
);
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
CREATE TABLE "sale"."delivery_note_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"delivery_note_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint,
	"serial_numbers" jsonb,
	"remarks" text,
	"movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "delivery_note_items_amounts_check" CHECK (quantity > 0 AND unit_price >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."delivery_notes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"order_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"status" text DEFAULT 'prepared' NOT NULL,
	"delivery_date" date NOT NULL,
	"project_name" text,
	"project_location" text,
	"recipient_name" text NOT NULL,
	"recipient_address" text,
	"recipient_pic" varchar(200),
	"recipient_contact" varchar(200),
	"driver_name" varchar(200),
	"vehicle_number" varchar(32),
	"notes" text,
	"shipped_at" bigint,
	"shipped_by" text,
	"received_at" bigint,
	"receiver_name" text,
	"cancelled_at" bigint,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "delivery_notes_status_check" CHECK (status IN ('prepared', 'shipped', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sale"."invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"invoice_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text,
	"quantity" numeric(18,4) DEFAULT '0' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "invoice_items_quantity_check" CHECK (quantity >= 0),
	CONSTRAINT "invoice_items_unit_price_check" CHECK (unit_price >= 0),
	CONSTRAINT "invoice_items_discount_check" CHECK (discount_amount >= 0),
	CONSTRAINT "invoice_items_tax_check" CHECK (tax_amount >= 0),
	CONSTRAINT "invoice_items_line_total_check" CHECK (line_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32),
	"invoice_type" text DEFAULT 'sales' NOT NULL,
	"term_kind" text,
	"customer_id" uuid,
	"company_id" uuid,
	"customer_snapshot" jsonb,
	"order_id" uuid,
	"order_code" varchar(32),
	"quotation_code" varchar(40),
	"title" text,
	"description" text,
	"percentage_bps" integer,
	"payment_term_id" uuid,
	"issue_date" date,
	"due_date" date,
	"vat_enabled" boolean DEFAULT true NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"paid_total" bigint DEFAULT 0 NOT NULL,
	"outstanding_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"terms" text,
	"notes" text,
	"created_by" text,
	"issued_by" text,
	"issued_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"voided_by" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "invoices_type_check" CHECK (invoice_type IN ('sales', 'proforma', 'recurring')),
	CONSTRAINT "invoices_term_kind_check" CHECK (term_kind IS NULL OR term_kind IN ('down_payment', 'installment', 'settlement')),
	CONSTRAINT "invoices_status_check" CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void', 'cancelled')),
	CONSTRAINT "invoices_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000),
	CONSTRAINT "invoices_subtotal_check" CHECK (subtotal >= 0),
	CONSTRAINT "invoices_discount_total_check" CHECK (discount_total >= 0),
	CONSTRAINT "invoices_tax_total_check" CHECK (tax_total >= 0),
	CONSTRAINT "invoices_grand_total_check" CHECK (grand_total >= 0),
	CONSTRAINT "invoices_paid_total_check" CHECK (paid_total >= 0 AND paid_total <= grand_total),
	CONSTRAINT "invoices_outstanding_total_check" CHECK (outstanding_total >= 0),
	CONSTRAINT "invoices_due_after_issue_check" CHECK (due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date)
);
--> statement-breakpoint
CREATE TABLE "sale"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"order_id" uuid NOT NULL,
	"quotation_item_id" uuid,
	"product_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"quantity_delivered" numeric(18,3) DEFAULT '0' NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "order_items_amounts_check" CHECK (quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND line_total >= 0 AND quantity_delivered >= 0),
	CONSTRAINT "order_items_fulfillment_status_check" CHECK (fulfillment_status IN ('pending', 'reserved', 'partial', 'fulfilled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sale"."order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" bigint NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sale"."orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"quotation_id" uuid NOT NULL,
	"quotation_code" varchar(40) NOT NULL,
	"customer_id" uuid,
	"company_id" uuid,
	"lead_id" uuid,
	"customer_snapshot" jsonb NOT NULL,
	"customer_po_number" varchar(100),
	"title" text NOT NULL,
	"attention" varchar(200),
	"status" text DEFAULT 'confirmed' NOT NULL,
	"order_date" date NOT NULL,
	"delivery_date" date,
	"payment_terms" varchar(300),
	"payment_schedule" jsonb,
	"guarantee" varchar(300),
	"vat_enabled" boolean NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"sales_person_user_id" text,
	"notes" text,
	"created_by" text,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancellation_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "orders_status_check" CHECK (status IN ('confirmed', 'in_progress', 'delivered', 'completed', 'cancelled')),
	CONSTRAINT "orders_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000),
	CONSTRAINT "orders_amounts_check" CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"quotation_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"image_object_key" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "quotation_items_amounts_check" CHECK (quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND line_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."quotation_status_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"quotation_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" bigint NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sale"."quotations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40) NOT NULL,
	"base_code" varchar(32) NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"previous_revision_id" uuid,
	"title" text NOT NULL,
	"heading" varchar(120),
	"customer_id" uuid,
	"company_id" uuid,
	"customer_snapshot" jsonb NOT NULL,
	"lead_id" uuid,
	"attention" varchar(200),
	"status" text DEFAULT 'draft' NOT NULL,
	"quotation_date" date NOT NULL,
	"valid_until" date,
	"payment_terms" varchar(300),
	"payment_schedule" jsonb,
	"guarantee" varchar(300),
	"vat_enabled" boolean DEFAULT true NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"notes" text,
	"terms" text,
	"created_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"rejected_reason" text,
	"sent_by" text,
	"sent_at" bigint,
	"closed_by" text,
	"closed_at" bigint,
	"lost_reason" text,
	"lost_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "quotations_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'sent', 'superseded', 'won', 'lost')),
	CONSTRAINT "quotations_lost_reason_check" CHECK (lost_reason IS NULL OR lost_reason IN ('price', 'competitor', 'project_cancelled', 'no_response', 'other')),
	CONSTRAINT "quotations_revision_check" CHECK (revision >= 0),
	CONSTRAINT "quotations_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000),
	CONSTRAINT "quotations_amounts_check" CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_id" uuid,
	"received_date" date,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"received_by" text,
	"posted_at" bigint,
	"reversed_by" text,
	"reversed_at" bigint,
	"reversal_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "receipts_status_check" CHECK (status IN ('draft', 'verified', 'posted', 'reversed', 'void')),
	CONSTRAINT "receipts_amount_check" CHECK (amount > 0),
	CONSTRAINT "receipts_method_check" CHECK (method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'))
);
--> statement-breakpoint
CREATE TABLE "sale"."return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"return_id" uuid NOT NULL,
	"delivery_note_item_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"condition" text,
	"bin_id" uuid,
	"movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "return_items_amounts_check" CHECK (quantity > 0 AND unit_price >= 0 AND unit_cost >= 0 AND line_total >= 0),
	CONSTRAINT "return_items_condition_check" CHECK (condition IS NULL OR condition IN ('good', 'damaged'))
);
--> statement-breakpoint
CREATE TABLE "sale"."returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32),
	"delivery_note_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"warehouse_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"return_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"rejection_reason" text,
	"created_by" text,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"received_by" text,
	"received_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "returns_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'cancelled')),
	CONSTRAINT "returns_total_check" CHECK (total_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."code_numberings" (
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
	CONSTRAINT "sale_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "sale_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "sale"."settings" (
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
	CONSTRAINT "sale_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
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
CREATE TABLE "tax"."code_numberings" (
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
	CONSTRAINT "tax_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "tax_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "tax"."corrections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tax_record_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"reason" text NOT NULL,
	"evidence_document_id" uuid,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tax_corrections_amount_check" CHECK (amount <> 0),
	CONSTRAINT "tax_corrections_reason_check" CHECK (char_length(trim(reason)) > 0)
);
--> statement-breakpoint
CREATE TABLE "tax"."records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
CREATE TABLE "tax"."taxes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
	CONSTRAINT "taxes_tax_type_check" CHECK (tax_type IN ('ppn', 'pph', 'ppn_input', 'ppn_output', 'other')),
	CONSTRAINT "taxes_base_type_check" CHECK (base_type IN ('gross', 'net', 'specific')),
	CONSTRAINT "taxes_rate_check" CHECK (rate >= 0),
	CONSTRAINT "taxes_effective_range_check" CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE TABLE "tax"."withholding_tax_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
CREATE TABLE "ticket"."code_numberings" (
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
	CONSTRAINT "ticket_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "ticket_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "ticket"."ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"ticket_id" uuid NOT NULL,
	"author_type" text DEFAULT 'staff' NOT NULL,
	"author_user_id" text,
	"author_name" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "ticket_messages_visibility_check" CHECK (visibility IN ('internal', 'customer')),
	CONSTRAINT "ticket_messages_author_type_check" CHECK (author_type IN ('staff', 'customer')),
	CONSTRAINT "ticket_messages_customer_visible_check" CHECK (author_type = 'staff' OR visibility = 'customer')
);
--> statement-breakpoint
CREATE TABLE "ticket"."settings" (
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
	CONSTRAINT "ticket_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "ticket"."tickets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"ticket_type" text DEFAULT 'other' NOT NULL,
	"parent_ticket_id" uuid,
	"ticket_template_id" uuid,
	"customer_id" uuid,
	"company_id" uuid,
	"customer_name" text NOT NULL,
	"project_id" uuid,
	"warranty_id" uuid,
	"item_serial_id" uuid,
	"serial_number" varchar(100),
	"device_description" varchar(300),
	"channel" text DEFAULT 'phone' NOT NULL,
	"reporter_name" varchar(200) NOT NULL,
	"reporter_contact" varchar(200),
	"complaint" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"reported_at" bigint NOT NULL,
	"in_warranty" boolean DEFAULT false NOT NULL,
	"warranty_ends_on" date,
	"warranty_code" varchar(80),
	"status" text DEFAULT 'new' NOT NULL,
	"assignee_user_id" text,
	"resolution" text,
	"service_cost" bigint DEFAULT 0 NOT NULL,
	"resolved_by" text,
	"resolved_at" bigint,
	"confirmed_by_name" varchar(200),
	"confirmation_channel" text,
	"confirmed_at" bigint,
	"closed_by" text,
	"closed_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tickets_type_check" CHECK (ticket_type IN ('installation', 'repair', 'maintenance', 'warranty_service', 'inspection', 'other')),
	CONSTRAINT "tickets_status_check" CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
	CONSTRAINT "tickets_priority_check" CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "tickets_channel_check" CHECK (channel IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')),
	CONSTRAINT "tickets_confirmation_channel_check" CHECK (confirmation_channel IS NULL OR confirmation_channel IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')),
	CONSTRAINT "tickets_service_cost_check" CHECK (service_cost >= 0)
);
--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit"."audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_idx" ON "audit"."audit_logs" ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit"."audit_logs" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit"."audit_logs" ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit"."audit_logs" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "auth"."accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "apikeys_configId_idx" ON "auth"."apikeys" ("config_id");--> statement-breakpoint
CREATE INDEX "apikeys_referenceId_idx" ON "auth"."apikeys" ("reference_id");--> statement-breakpoint
CREATE INDEX "apikeys_key_idx" ON "auth"."apikeys" ("key");--> statement-breakpoint
CREATE INDEX "invitations_organizationId_idx" ON "auth"."invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "auth"."invitations" ("email");--> statement-breakpoint
CREATE INDEX "members_organizationId_idx" ON "auth"."members" ("organization_id");--> statement-breakpoint
CREATE INDEX "members_userId_idx" ON "auth"."members" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_settings_scope_uq" ON "auth"."organization_settings" ("organization_id","setting_group","setting_key");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "auth"."organizations" ("slug");--> statement-breakpoint
CREATE INDEX "passkeys_userId_idx" ON "auth"."passkeys" ("user_id");--> statement-breakpoint
CREATE INDEX "passkeys_credentialID_idx" ON "auth"."passkeys" ("credential_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "auth"."sessions" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_invitations_token_hash_idx" ON "auth"."user_invitations" ("token_hash");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "auth"."user_invitations" ("email");--> statement-breakpoint
CREATE INDEX "user_invitations_organizationId_idx" ON "auth"."user_invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "user_invitations_status_idx" ON "auth"."user_invitations" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_live_idx" ON "auth"."users" ("phone") WHERE phone IS NOT NULL;--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "auth"."verifications" ("identifier");--> statement-breakpoint
CREATE INDEX "faq_entries_is_active_idx" ON "automation"."faq_entries" ("is_active");--> statement-breakpoint
CREATE INDEX "outbox_messages_status_idx" ON "automation"."outbox_messages" ("status");--> statement-breakpoint
CREATE INDEX "outbox_messages_topic_idx" ON "automation"."outbox_messages" ("topic");--> statement-breakpoint
CREATE INDEX "outbox_messages_aggregate_idx" ON "automation"."outbox_messages" ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_messages_dedupe_key_key" ON "automation"."outbox_messages" ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_conversations_chat_id_key" ON "automation"."whatsapp_conversations" ("chat_id");--> statement-breakpoint
CREATE INDEX "whatsapp_conversations_status_idx" ON "automation"."whatsapp_conversations" ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_conversation_idx" ON "automation"."whatsapp_messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_direction_external_id_key" ON "automation"."whatsapp_messages" ("direction","external_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_status_idx" ON "automation"."whatsapp_messages" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_primary_uq" ON "company"."addresses" ("is_primary") WHERE deleted_at IS NULL AND is_primary;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_singleton_uq" ON "company"."profiles" ((true)) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "company_settings_scope_uq" ON "company"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_primary_per_type_uq" ON "company"."contacts" ("contact_type","is_primary") WHERE deleted_at IS NULL AND is_primary;--> statement-breakpoint
CREATE INDEX "contacts_value_idx" ON "company"."contacts" ("value");--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer"."addresses" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_code_numberings_type_uq" ON "customer"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_companies_code_uq" ON "customer"."companies" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "customer_companies_name_idx" ON "customer"."companies" ("name");--> statement-breakpoint
CREATE INDEX "customer_companies_tax_id_idx" ON "customer"."companies" ("tax_id");--> statement-breakpoint
CREATE INDEX "customer_companies_owner_user_id_idx" ON "customer"."companies" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "customer_company_addresses_company_id_idx" ON "customer"."company_addresses" ("company_id");--> statement-breakpoint
CREATE INDEX "customer_company_addresses_kind_idx" ON "customer"."company_addresses" ("company_id","kind","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_settings_scope_uq" ON "customer"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_uq" ON "customer"."customers" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_uq" ON "customer"."customers" ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_primary_uq" ON "customer"."customers" ("company_id") WHERE is_primary AND deleted_at IS NULL AND company_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "customers_company_id_idx" ON "customer"."customers" ("company_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customer"."customers" ("name");--> statement-breakpoint
CREATE INDEX "customers_owner_user_id_idx" ON "customer"."customers" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "access_logs_document_id_idx" ON "document"."access_logs" ("document_id");--> statement-breakpoint
CREATE INDEX "access_logs_accessed_at_idx" ON "document"."access_logs" ("accessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "document_code_numberings_type_uq" ON "document"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "files_document_id_idx" ON "document"."files" ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_uq" ON "document"."files" ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "document_settings_scope_uq" ON "document"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "shares_document_id_idx" ON "document"."shares" ("document_id");--> statement-breakpoint
CREATE INDEX "shares_target_idx" ON "document"."shares" ("share_type","shared_with_type","shared_with_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_token_uq" ON "document"."shares" ("token") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "shares_token_live_idx" ON "document"."shares" ("token","expires_at") WHERE deleted_at IS NULL AND is_revoked = false;--> statement-breakpoint
CREATE INDEX "signature_requests_document_id_idx" ON "document"."signature_requests" ("document_id");--> statement-breakpoint
CREATE INDEX "signature_requests_signer_status_idx" ON "document"."signature_requests" ("signer_user_id","status");--> statement-breakpoint
CREATE INDEX "signature_requests_requested_by_idx" ON "document"."signature_requests" ("requested_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_requests_pending_uq" ON "document"."signature_requests" ("document_id","signer_user_id") WHERE status = 'pending' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "signatures_document_id_idx" ON "document"."signatures" ("document_id");--> statement-breakpoint
CREATE INDEX "signatures_source_file_id_idx" ON "document"."signatures" ("source_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_links_uq" ON "document"."tag_links" ("document_id","document_tag_id");--> statement-breakpoint
CREATE INDEX "tag_links_tag_id_idx" ON "document"."tag_links" ("document_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_org_tag_uq" ON "document"."tags" ("organization_id","tag") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_global_tag_uq" ON "document"."tags" ("tag") WHERE deleted_at IS NULL AND organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_org_code_version_uq" ON "document"."templates" ("organization_id","code","version") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_global_code_version_uq" ON "document"."templates" ("code","version") WHERE deleted_at IS NULL AND organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_signatures_user_id_uq" ON "document"."user_signatures" ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_org_code_uq" ON "document"."documents" ("organization_id","code") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_global_code_uq" ON "document"."documents" ("code") WHERE deleted_at IS NULL AND organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "documents_template_id_idx" ON "document"."documents" ("template_id");--> statement-breakpoint
CREATE INDEX "documents_source_idx" ON "document"."documents" ("module","source_type","source_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "document"."documents" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_balances_account_period_uq" ON "finance"."account_balances" ("account_id","accounting_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_org_code_uq" ON "finance"."accounting_periods" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_period_uq" ON "finance"."accounting_periods" ("organization_id","period_year","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "ap_open_items_org_bill_uq" ON "finance"."ap_open_items" ("organization_id","supplier_bill_id");--> statement-breakpoint
CREATE INDEX "ap_open_items_supplier_company_id_idx" ON "finance"."ap_open_items" ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "ap_open_items_status_idx" ON "finance"."ap_open_items" ("status");--> statement-breakpoint
CREATE INDEX "ap_open_items_due_date_idx" ON "finance"."ap_open_items" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ar_open_items_org_invoice_uq" ON "finance"."ar_open_items" ("organization_id","invoice_id");--> statement-breakpoint
CREATE INDEX "ar_open_items_customer_id_idx" ON "finance"."ar_open_items" ("customer_id");--> statement-breakpoint
CREATE INDEX "ar_open_items_status_idx" ON "finance"."ar_open_items" ("status");--> statement-breakpoint
CREATE INDEX "ar_open_items_due_date_idx" ON "finance"."ar_open_items" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_depreciations_period_uq" ON "finance"."asset_depreciations" ("item_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "asset_depreciations_period_year_idx" ON "finance"."asset_depreciations" ("period_year");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_account_links_cash_bank_account_id_uq" ON "finance"."bank_account_links" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_account_links_chart_of_account_id_idx" ON "finance"."bank_account_links" ("chart_of_account_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_items_reconciliation_id_idx" ON "finance"."bank_reconciliation_items" ("bank_reconciliation_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_items_transaction_id_idx" ON "finance"."bank_reconciliation_items" ("cash_bank_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_reconciliations_org_code_uq" ON "finance"."bank_reconciliations" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_account_id_idx" ON "finance"."bank_reconciliations" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_date_idx" ON "finance"."bank_reconciliations" ("reconciliation_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_bank_accounts_org_code_uq" ON "finance"."cash_bank_accounts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cash_bank_accounts_account_number_idx" ON "finance"."cash_bank_accounts" ("account_number");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_bank_transactions_org_code_uq" ON "finance"."cash_bank_transactions" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cash_bank_transactions_account_id_idx" ON "finance"."cash_bank_transactions" ("cash_bank_account_id");--> statement-breakpoint
CREATE INDEX "cash_bank_transactions_date_idx" ON "finance"."cash_bank_transactions" ("transaction_date");--> statement-breakpoint
CREATE INDEX "cash_bank_transactions_source_idx" ON "finance"."cash_bank_transactions" ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_of_accounts_org_code_uq" ON "finance"."chart_of_accounts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_parent_account_id_idx" ON "finance"."chart_of_accounts" ("parent_account_id");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_account_type_idx" ON "finance"."chart_of_accounts" ("account_type");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_code_numberings_type_uq" ON "finance"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_settings_scope_uq" ON "finance"."settings" ("organization_id","setting_group","setting_key");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_org_code_uq" ON "finance"."journal_entries" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_idempotency_uq" ON "finance"."journal_entries" ("organization_id","idempotency_key") WHERE idempotency_key IS NOT NULL AND status <> 'void';--> statement-breakpoint
CREATE INDEX "journal_entries_period_id_idx" ON "finance"."journal_entries" ("accounting_period_id");--> statement-breakpoint
CREATE INDEX "journal_entries_status_idx" ON "finance"."journal_entries" ("status");--> statement-breakpoint
CREATE INDEX "journal_entries_entry_date_idx" ON "finance"."journal_entries" ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_source_type_idx" ON "finance"."journal_entries" ("source_type");--> statement-breakpoint
CREATE INDEX "journal_entries_source_id_idx" ON "finance"."journal_entries" ("source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_id_idx" ON "finance"."journal_lines" ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_id_idx" ON "finance"."journal_lines" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_lines_line_no_uq" ON "finance"."journal_lines" ("journal_entry_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_balances_account_date_uq" ON "finance"."opening_balances" ("account_id","as_of_date");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_terms_org_code_uq" ON "finance"."payment_terms" ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "report_archives_scope_uq" ON "finance"."report_archives" ("organization_id","period_year","period_month","report_type");--> statement-breakpoint
CREATE INDEX "supplier_bill_items_supplier_bill_id_idx" ON "finance"."supplier_bill_items" ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_items_purchase_order_item_id_idx" ON "finance"."supplier_bill_items" ("purchase_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_bills_org_code_uq" ON "finance"."supplier_bills" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "supplier_bills_supplier_company_id_idx" ON "finance"."supplier_bills" ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "supplier_bills_purchase_order_id_idx" ON "finance"."supplier_bills" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_bills_status_idx" ON "finance"."supplier_bills" ("status");--> statement-breakpoint
CREATE INDEX "supplier_bills_due_date_idx" ON "finance"."supplier_bills" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_day_uq" ON "human_resource"."attendances" ("employee_id","attendance_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "attendances_date_idx" ON "human_resource"."attendances" ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendances_leave_request_id_idx" ON "human_resource"."attendances" ("leave_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salaries_period_uq" ON "human_resource"."employee_salaries" ("employee_id","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employee_salaries_employee_id_idx" ON "human_resource"."employee_salaries" ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_records_period_uq" ON "human_resource"."employee_salary_records" ("period","employee_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employee_salary_records_period_idx" ON "human_resource"."employee_salary_records" ("period");--> statement-breakpoint
CREATE INDEX "employee_salary_records_employee_id_idx" ON "human_resource"."employee_salary_records" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_tasks_employee_id_idx" ON "human_resource"."employee_tasks" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_tasks_status_idx" ON "human_resource"."employee_tasks" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_org_code_uq" ON "human_resource"."employees" ("organization_id","employee_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_user_uq" ON "human_resource"."employees" ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employees_manager_employee_id_idx" ON "human_resource"."employees" ("manager_employee_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "human_resource"."employees" ("employment_status");--> statement-breakpoint
CREATE INDEX "employees_national_id_idx" ON "human_resource"."employees" ("national_id");--> statement-breakpoint
CREATE INDEX "employees_org_name_idx" ON "human_resource"."employees" ("organization_id","full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "human_resource_code_numberings_type_uq" ON "human_resource"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "human_resource_settings_scope_uq" ON "human_resource"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "leave_requests_employee_id_idx" ON "human_resource"."leave_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "human_resource"."leave_requests" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_code_uq" ON "human_resource"."leave_types" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "overtime_requests_employee_id_idx" ON "human_resource"."overtime_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "overtime_requests_work_date_idx" ON "human_resource"."overtime_requests" ("work_date");--> statement-breakpoint
CREATE INDEX "borrowing_events_borrowing_occurred_idx" ON "inventory"."borrowing_events" ("borrowing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "borrowing_events_item_id_idx" ON "inventory"."borrowing_events" ("borrowing_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_items_request_item_uq" ON "inventory"."borrowing_items" ("borrowing_request_id","item_id");--> statement-breakpoint
CREATE INDEX "borrowing_items_borrowing_id_idx" ON "inventory"."borrowing_items" ("borrowing_id");--> statement-breakpoint
CREATE INDEX "borrowing_items_item_id_idx" ON "inventory"."borrowing_items" ("item_id");--> statement-breakpoint
CREATE INDEX "borrowing_items_open_idx" ON "inventory"."borrowing_items" ("due_at") WHERE returned_at IS NULL AND marked_lost_at IS NULL;--> statement-breakpoint
CREATE INDEX "borrowing_request_events_request_occurred_idx" ON "inventory"."borrowing_request_events" ("borrowing_request_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_requests_org_code_uq" ON "inventory"."borrowing_requests" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_requests_global_code_uq" ON "inventory"."borrowing_requests" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "borrowing_requests_status_idx" ON "inventory"."borrowing_requests" ("status");--> statement-breakpoint
CREATE INDEX "borrowing_requests_borrower_user_id_idx" ON "inventory"."borrowing_requests" ("borrower_user_id");--> statement-breakpoint
CREATE INDEX "borrowing_requests_borrower_customer_id_idx" ON "inventory"."borrowing_requests" ("borrower_customer_id");--> statement-breakpoint
CREATE INDEX "borrowing_requests_due_at_idx" ON "inventory"."borrowing_requests" ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_org_code_uq" ON "inventory"."borrowings" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_global_code_uq" ON "inventory"."borrowings" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_request_uq" ON "inventory"."borrowings" ("borrowing_request_id");--> statement-breakpoint
CREATE INDEX "borrowings_status_idx" ON "inventory"."borrowings" ("status");--> statement-breakpoint
CREATE INDEX "borrowings_due_at_idx" ON "inventory"."borrowings" ("due_at");--> statement-breakpoint
CREATE INDEX "condition_checks_item_id_idx" ON "inventory"."condition_checks" ("item_id");--> statement-breakpoint
CREATE INDEX "condition_checks_check_date_idx" ON "inventory"."condition_checks" ("check_date");--> statement-breakpoint
CREATE UNIQUE INDEX "disposals_org_code_uq" ON "inventory"."disposals" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "disposals_global_code_uq" ON "inventory"."disposals" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "disposals_item_id_idx" ON "inventory"."disposals" ("item_id");--> statement-breakpoint
CREATE INDEX "disposals_status_idx" ON "inventory"."disposals" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_code_numberings_type_uq" ON "inventory"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_documents_product_id_idx" ON "inventory"."documents" ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_documents_item_id_idx" ON "inventory"."documents" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_settings_scope_uq" ON "inventory"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_categories_org_code_uq" ON "inventory"."item_categories" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_categories_global_code_uq" ON "inventory"."item_categories" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "item_categories_parent_category_id_idx" ON "inventory"."item_categories" ("parent_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_serials_org_serial_uq" ON "inventory"."item_serials" ("organization_id","serial_number") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_serials_global_serial_uq" ON "inventory"."item_serials" ("serial_number") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "item_serials_product_id_idx" ON "inventory"."item_serials" ("product_id");--> statement-breakpoint
CREATE INDEX "item_serials_status_idx" ON "inventory"."item_serials" ("status");--> statement-breakpoint
CREATE INDEX "item_serials_warehouse_id_idx" ON "inventory"."item_serials" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_code_uq" ON "inventory"."items" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "items_serial_uq" ON "inventory"."items" (coalesce("organization_id", ''),"serial_number") WHERE "serial_number" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "items_item_kind_idx" ON "inventory"."items" ("item_kind");--> statement-breakpoint
CREATE INDEX "items_item_category_id_idx" ON "inventory"."items" ("item_category_id");--> statement-breakpoint
CREATE INDEX "items_custodian_employee_id_idx" ON "inventory"."items" ("custodian_employee_id");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "inventory"."items" ("status");--> statement-breakpoint
CREATE INDEX "items_warehouse_id_idx" ON "inventory"."items" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "items_storage_id_idx" ON "inventory"."items" ("storage_id");--> statement-breakpoint
CREATE INDEX "items_serial_number_idx" ON "inventory"."items" ("serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenances_org_code_uq" ON "inventory"."maintenances" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenances_global_code_uq" ON "inventory"."maintenances" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "maintenances_item_id_idx" ON "inventory"."maintenances" ("item_id");--> statement-breakpoint
CREATE INDEX "maintenances_status_idx" ON "inventory"."maintenances" ("status");--> statement-breakpoint
CREATE INDEX "maintenances_next_service_date_idx" ON "inventory"."maintenances" ("next_service_date");--> statement-breakpoint
CREATE UNIQUE INDEX "movements_org_code_uq" ON "inventory"."movements" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "movements_global_code_uq" ON "inventory"."movements" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "movements_product_ledger_idx" ON "inventory"."movements" ("organization_id","product_id","warehouse_id","occurred_at");--> statement-breakpoint
CREATE INDEX "movements_item_ledger_idx" ON "inventory"."movements" ("organization_id","item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "movements_bin_id_idx" ON "inventory"."movements" ("bin_id");--> statement-breakpoint
CREATE INDEX "movements_reference_type_idx" ON "inventory"."movements" ("reference_type");--> statement-breakpoint
CREATE INDEX "movements_reference_id_idx" ON "inventory"."movements" ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_uq" ON "inventory"."product_categories" ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_code_uq" ON "inventory"."products" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_global_code_uq" ON "inventory"."products" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_sku_uq" ON "inventory"."products" ("organization_id","sku") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_global_sku_uq" ON "inventory"."products" ("sku") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uq" ON "inventory"."products" ("slug") WHERE deleted_at IS NULL AND slug IS NOT NULL;--> statement-breakpoint
CREATE INDEX "products_kind_idx" ON "inventory"."products" ("product_kind");--> statement-breakpoint
CREATE INDEX "products_org_name_idx" ON "inventory"."products" ("organization_id","name");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "inventory"."products" ("barcode");--> statement-breakpoint
CREATE INDEX "stock_adjustment_items_adjustment_id_idx" ON "inventory"."stock_adjustment_items" ("stock_adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_org_code_uq" ON "inventory"."stock_adjustments" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "stock_adjustments_warehouse_id_idx" ON "inventory"."stock_adjustments" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_status_idx" ON "inventory"."stock_adjustments" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_org_scope_uq" ON "inventory"."stocks" ("organization_id","warehouse_id","product_id","bin_id") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_global_scope_uq" ON "inventory"."stocks" ("warehouse_id","product_id","bin_id") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "stocks_product_id_idx" ON "inventory"."stocks" ("product_id");--> statement-breakpoint
CREATE INDEX "tool_set_items_tool_set_id_idx" ON "inventory"."tool_set_items" ("tool_set_id");--> statement-breakpoint
CREATE INDEX "tool_set_items_item_id_idx" ON "inventory"."tool_set_items" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_set_items_uq" ON "inventory"."tool_set_items" ("tool_set_id","item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sets_org_code_uq" ON "inventory"."tool_sets" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sets_global_code_uq" ON "inventory"."tool_sets" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "tool_sets_custodian_employee_id_idx" ON "inventory"."tool_sets" ("custodian_employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_addresses_warehouse_uq" ON "inventory"."warehouse_addresses" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_addresses_village_id_idx" ON "inventory"."warehouse_addresses" ("village_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_managers_uq" ON "inventory"."warehouse_managers" ("warehouse_id","user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_managers_user_id_idx" ON "inventory"."warehouse_managers" ("user_id");--> statement-breakpoint
CREATE INDEX "warehouse_organizations_warehouse_id_idx" ON "inventory"."warehouse_organizations" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_organizations_organization_id_idx" ON "inventory"."warehouse_organizations" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_organizations_uq" ON "inventory"."warehouse_organizations" ("warehouse_id","organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_settings_uq" ON "inventory"."warehouse_settings" ("warehouse_id","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_storages_warehouse_id_idx" ON "inventory"."warehouse_storages" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_storages_warehouse_code_uq" ON "inventory"."warehouse_storages" ("warehouse_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_code_uq" ON "inventory"."warehouses" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_code_uq" ON "inventory"."warehouses" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "warehouses_is_default_idx" ON "inventory"."warehouses" ("is_default");--> statement-breakpoint
CREATE INDEX "warehouses_is_active_idx" ON "inventory"."warehouses" ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_default_uq" ON "inventory"."warehouses" ("organization_id") WHERE organization_id IS NOT NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_default_uq" ON "inventory"."warehouses" (coalesce("organization_id", '00000000-0000-0000-0000-000000000000')) WHERE organization_id IS NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "district_name_idx" ON "location"."districts" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "district_code_idx" ON "location"."districts" ("code");--> statement-breakpoint
CREATE INDEX "province_name_idx" ON "location"."provinces" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "province_code_idx" ON "location"."provinces" ("code");--> statement-breakpoint
CREATE INDEX "regency_name_idx" ON "location"."regencies" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "regency_code_idx" ON "location"."regencies" ("code");--> statement-breakpoint
CREATE INDEX "village_name_idx" ON "location"."villages" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "village_code_idx" ON "location"."villages" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "push_push_notification_templates_code_uq" ON "notification"."push_notification_templates" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "push_push_notification_templates_channel_idx" ON "notification"."push_notification_templates" ("channel");--> statement-breakpoint
CREATE INDEX "push_notifications_user_id_idx" ON "notification"."push_notifications" ("user_id");--> statement-breakpoint
CREATE INDEX "push_notifications_user_status_idx" ON "notification"."push_notifications" ("user_id","status");--> statement-breakpoint
CREATE INDEX "push_notifications_status_idx" ON "notification"."push_notifications" ("status");--> statement-breakpoint
CREATE INDEX "push_notifications_created_at_idx" ON "notification"."push_notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "push_notifications_template_id_idx" ON "notification"."push_notifications" ("notification_template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateways_org_provider_code_uq" ON "payment"."gateways" ("organization_id","provider","code");--> statement-breakpoint
CREATE INDEX "gateways_provider_idx" ON "payment"."gateways" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_uq" ON "payment"."payment_allocations" ("payment_id","payable_type","payable_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payable_idx" ON "payment"."payment_allocations" ("payable_type","payable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_code_numberings_type_uq" ON "payment"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_settings_scope_uq" ON "payment"."settings" ("organization_id","setting_group","setting_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_org_code_uq" ON "payment"."payments" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payment"."payments" ("status");--> statement-breakpoint
CREATE INDEX "payments_counterparty_idx" ON "payment"."payments" ("organization_id","counterparty_type","counterparty_id");--> statement-breakpoint
CREATE INDEX "payments_cash_bank_account_id_idx" ON "payment"."payments" ("cash_bank_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_uq" ON "payment"."payments" ("provider","provider_reference") WHERE provider_reference IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_receipt_id_uq" ON "payment"."payments" ("receipt_id") WHERE receipt_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "procurement"."goods_receipt_items" ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_purchase_order_item_id_idx" ON "procurement"."goods_receipt_items" ("purchase_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_code_uq" ON "procurement"."goods_receipts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "procurement"."goods_receipts" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_warehouse_id_idx" ON "procurement"."goods_receipts" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_code_numberings_type_uq" ON "procurement"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "purchase_order_items_order_sort_idx" ON "procurement"."purchase_order_items" ("purchase_order_id","sort_order");--> statement-breakpoint
CREATE INDEX "purchase_order_items_purchase_request_item_id_idx" ON "procurement"."purchase_order_items" ("purchase_request_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_code_uq" ON "procurement"."purchase_orders" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_company_id_idx" ON "procurement"."purchase_orders" ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "procurement"."purchase_orders" ("status");--> statement-breakpoint
CREATE INDEX "purchase_request_items_request_sort_idx" ON "procurement"."purchase_request_items" ("purchase_request_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requests_code_uq" ON "procurement"."purchase_requests" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_requests_status_idx" ON "procurement"."purchase_requests" ("status");--> statement-breakpoint
CREATE INDEX "purchase_requests_requested_by_idx" ON "procurement"."purchase_requests" ("requested_by");--> statement-breakpoint
CREATE INDEX "purchase_return_items_purchase_return_id_idx" ON "procurement"."purchase_return_items" ("purchase_return_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_goods_receipt_item_id_idx" ON "procurement"."purchase_return_items" ("goods_receipt_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_returns_code_uq" ON "procurement"."purchase_returns" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_returns_goods_receipt_id_idx" ON "procurement"."purchase_returns" ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_purchase_order_id_idx" ON "procurement"."purchase_returns" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_status_idx" ON "procurement"."purchase_returns" ("status");--> statement-breakpoint
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
CREATE INDEX "delivery_note_items_delivery_note_id_idx" ON "sale"."delivery_note_items" ("delivery_note_id");--> statement-breakpoint
CREATE INDEX "delivery_note_items_order_item_id_idx" ON "sale"."delivery_note_items" ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_notes_code_uq" ON "sale"."delivery_notes" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "delivery_notes_order_id_idx" ON "sale"."delivery_notes" ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_status_idx" ON "sale"."delivery_notes" ("status");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "sale"."invoice_items" ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_product_id_idx" ON "sale"."invoice_items" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_code_uq" ON "sale"."invoices" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "sale"."invoices" ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_company_id_idx" ON "sale"."invoices" ("company_id");--> statement-breakpoint
CREATE INDEX "invoices_order_id_idx" ON "sale"."invoices" ("order_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "sale"."invoices" ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "sale"."invoices" ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_term_kind_idx" ON "sale"."invoices" ("term_kind");--> statement-breakpoint
CREATE INDEX "order_items_order_sort_idx" ON "sale"."order_items" ("order_id","sort_order");--> statement-breakpoint
CREATE INDEX "order_items_fulfillment_status_idx" ON "sale"."order_items" ("fulfillment_status");--> statement-breakpoint
CREATE INDEX "order_status_history_order_id_idx" ON "sale"."order_status_history" ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_code_uq" ON "sale"."orders" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_live_quotation_uq" ON "sale"."orders" ("quotation_id") WHERE deleted_at IS NULL AND status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "orders_quotation_id_idx" ON "sale"."orders" ("quotation_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "sale"."orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_company_id_idx" ON "sale"."orders" ("company_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "sale"."orders" ("status");--> statement-breakpoint
CREATE INDEX "orders_sales_person_idx" ON "sale"."orders" ("sales_person_user_id");--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_sort_idx" ON "sale"."quotation_items" ("quotation_id","sort_order");--> statement-breakpoint
CREATE INDEX "quotation_status_history_quotation_id_idx" ON "sale"."quotation_status_history" ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_code_uq" ON "sale"."quotations" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "quotations_base_code_idx" ON "sale"."quotations" ("base_code");--> statement-breakpoint
CREATE INDEX "quotations_customer_id_idx" ON "sale"."quotations" ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_company_id_idx" ON "sale"."quotations" ("company_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "sale"."quotations" ("status");--> statement-breakpoint
CREATE INDEX "quotations_created_by_idx" ON "sale"."quotations" ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_code_uq" ON "sale"."receipts" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "receipts_invoice_id_idx" ON "sale"."receipts" ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_payment_id_idx" ON "sale"."receipts" ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_status_idx" ON "sale"."receipts" ("status");--> statement-breakpoint
CREATE INDEX "return_items_return_id_idx" ON "sale"."return_items" ("return_id");--> statement-breakpoint
CREATE INDEX "return_items_delivery_note_item_id_idx" ON "sale"."return_items" ("delivery_note_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "returns_code_uq" ON "sale"."returns" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "returns_delivery_note_id_idx" ON "sale"."returns" ("delivery_note_id");--> statement-breakpoint
CREATE INDEX "returns_order_id_idx" ON "sale"."returns" ("order_id");--> statement-breakpoint
CREATE INDEX "returns_status_idx" ON "sale"."returns" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_code_numberings_type_uq" ON "sale"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_settings_scope_uq" ON "sale"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
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
CREATE UNIQUE INDEX "tax_code_numberings_type_uq" ON "tax"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tax_corrections_tax_record_id_idx" ON "tax"."corrections" ("tax_record_id");--> statement-breakpoint
CREATE INDEX "tax_corrections_evidence_document_id_idx" ON "tax"."corrections" ("evidence_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_records_org_code_uq" ON "tax"."records" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_records_org_type_period_uq" ON "tax"."records" ("organization_id","tax_type_id","period_year","period_month") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tax_records_tax_type_id_idx" ON "tax"."records" ("tax_type_id");--> statement-breakpoint
CREATE INDEX "tax_records_period_idx" ON "tax"."records" ("organization_id","period_year","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "taxes_org_code_effective_uq" ON "tax"."taxes" ("organization_id","code","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "taxes_effective_from_idx" ON "tax"."taxes" ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "withholding_tax_records_org_code_uq" ON "tax"."withholding_tax_records" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "withholding_tax_records_tax_type_id_idx" ON "tax"."withholding_tax_records" ("tax_type_id");--> statement-breakpoint
CREATE INDEX "withholding_tax_records_counterparty_idx" ON "tax"."withholding_tax_records" ("counterparty_type","counterparty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_code_numberings_type_uq" ON "ticket"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_created_idx" ON "ticket"."ticket_messages" ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_settings_scope_uq" ON "ticket"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_code_uq" ON "ticket"."tickets" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tickets_customer_id_idx" ON "ticket"."tickets" ("customer_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_idx" ON "ticket"."tickets" ("company_id");--> statement-breakpoint
CREATE INDEX "tickets_project_id_idx" ON "ticket"."tickets" ("project_id");--> statement-breakpoint
CREATE INDEX "tickets_parent_ticket_id_idx" ON "ticket"."tickets" ("parent_ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_assignee_user_id_idx" ON "ticket"."tickets" ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "ticket"."tickets" ("status");--> statement-breakpoint
CREATE INDEX "tickets_serial_number_idx" ON "ticket"."tickets" ("serial_number");--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" ADD CONSTRAINT "user_invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "automation"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_3jpsZTHEO1Jd_fkey" FOREIGN KEY ("conversation_id") REFERENCES "automation"."whatsapp_conversations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "automation"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_faq_entry_id_faq_entries_id_fkey" FOREIGN KEY ("faq_entry_id") REFERENCES "automation"."faq_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "customer"."addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer"."company_addresses" ADD CONSTRAINT "company_addresses_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "customer"."companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD CONSTRAINT "customers_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "customer"."companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."account_balances" ADD CONSTRAINT "account_balances_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."account_balances" ADD CONSTRAINT "account_balances_uAjXjI3C2vZg_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "finance"."accounting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."ap_open_items" ADD CONSTRAINT "ap_open_items_supplier_bill_id_supplier_bills_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "finance"."supplier_bills"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."asset_depreciations" ADD CONSTRAINT "asset_depreciations_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."bank_account_links" ADD CONSTRAINT "bank_account_links_9L0JHVXVaDvx_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."bank_account_links" ADD CONSTRAINT "bank_account_links_p6TVhuHQoduP_fkey" FOREIGN KEY ("chart_of_account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_LO96nU6SLCO6_fkey" FOREIGN KEY ("bank_reconciliation_id") REFERENCES "finance"."bank_reconciliations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_5ntduObVqjWU_fkey" FOREIGN KEY ("cash_bank_transaction_id") REFERENCES "finance"."cash_bank_transactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_uOpNUxTRLd4E_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_OiQ8fTWxqUGx_fkey" FOREIGN KEY ("cash_bank_account_id") REFERENCES "finance"."cash_bank_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_accounting_period_id_accounting_periods_id_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "finance"."accounting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."opening_balances" ADD CONSTRAINT "opening_balances_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."supplier_bill_items" ADD CONSTRAINT "supplier_bill_items_supplier_bill_id_supplier_bills_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "finance"."supplier_bills"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "human_resource"."attendances" ADD CONSTRAINT "attendances_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."attendances" ADD CONSTRAINT "attendances_leave_request_id_leave_requests_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "human_resource"."leave_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD CONSTRAINT "employee_salary_records_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_tasks" ADD CONSTRAINT "employee_tasks_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD CONSTRAINT "employees_manager_employee_id_employees_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "human_resource"."leave_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "inventory"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_item_id_borrowing_items_id_fkey" FOREIGN KEY ("borrowing_item_id") REFERENCES "inventory"."borrowing_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_items" ADD CONSTRAINT "borrowing_items_borrowing_request_id_borrowing_requests_id_fkey" FOREIGN KEY ("borrowing_request_id") REFERENCES "inventory"."borrowing_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_items" ADD CONSTRAINT "borrowing_items_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "inventory"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_items" ADD CONSTRAINT "borrowing_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_request_events" ADD CONSTRAINT "borrowing_request_events_NBRRT8st1uwC_fkey" FOREIGN KEY ("borrowing_request_id") REFERENCES "inventory"."borrowing_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowings" ADD CONSTRAINT "borrowings_borrowing_request_id_borrowing_requests_id_fkey" FOREIGN KEY ("borrowing_request_id") REFERENCES "inventory"."borrowing_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."condition_checks" ADD CONSTRAINT "condition_checks_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."disposals" ADD CONSTRAINT "disposals_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."item_serials" ADD CONSTRAINT "item_serials_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."item_serials" ADD CONSTRAINT "item_serials_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."item_serials" ADD CONSTRAINT "item_serials_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_item_category_id_item_categories_id_fkey" FOREIGN KEY ("item_category_id") REFERENCES "inventory"."item_categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_storage_id_warehouse_storages_id_fkey" FOREIGN KEY ("storage_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."maintenances" ADD CONSTRAINT "maintenances_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_target_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("target_warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_target_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("target_bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."products" ADD CONSTRAINT "products_product_category_id_product_categories_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "inventory"."product_categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_Gis6x14AGR5M_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "inventory"."stock_adjustments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stocks" ADD CONSTRAINT "stocks_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stocks" ADD CONSTRAINT "stocks_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stocks" ADD CONSTRAINT "stocks_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."tool_set_items" ADD CONSTRAINT "tool_set_items_tool_set_id_tool_sets_id_fkey" FOREIGN KEY ("tool_set_id") REFERENCES "inventory"."tool_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."tool_set_items" ADD CONSTRAINT "tool_set_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_addresses" ADD CONSTRAINT "warehouse_addresses_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_managers" ADD CONSTRAINT "warehouse_managers_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_organizations" ADD CONSTRAINT "warehouse_organizations_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_settings" ADD CONSTRAINT "warehouse_settings_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_storages" ADD CONSTRAINT "warehouse_storages_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location"."districts" ADD CONSTRAINT "districts_regency_id_regencies_id_fkey" FOREIGN KEY ("regency_id") REFERENCES "location"."regencies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location"."regencies" ADD CONSTRAINT "regencies_province_id_provinces_id_fkey" FOREIGN KEY ("province_id") REFERENCES "location"."provinces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location"."villages" ADD CONSTRAINT "villages_district_id_districts_id_fkey" FOREIGN KEY ("district_id") REFERENCES "location"."districts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification"."push_notifications" ADD CONSTRAINT "push_notifications_ukQEOqgriDD1_fkey" FOREIGN KEY ("notification_template_id") REFERENCES "notification"."push_notification_templates"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payment"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"."payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_gateway_id_gateways_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment"."gateways"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_goods_receipts_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "procurement"."goods_receipts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_LfHoAU3Xn983_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "procurement"."purchase_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_9wVPh1SlEHf2_fkey" FOREIGN KEY ("purchase_request_item_id") REFERENCES "procurement"."purchase_request_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_request_items" ADD CONSTRAINT "purchase_request_items_Ux9VGEdMFJ2l_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "procurement"."purchase_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_Ixkuf3GYrG7c_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "procurement"."purchase_returns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_zWIWs6D5BjYk_fkey" FOREIGN KEY ("goods_receipt_item_id") REFERENCES "procurement"."goods_receipt_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_yhMa9BsZjRyG_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "procurement"."purchase_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_goods_receipt_id_goods_receipts_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "procurement"."goods_receipts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
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
ALTER TABLE "project"."warranties" ADD CONSTRAINT "warranties_handover_id_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "project"."handover"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_delivery_notes_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "sale"."delivery_notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_order_item_id_order_items_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "sale"."order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."delivery_notes" ADD CONSTRAINT "delivery_notes_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sale"."orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sale"."invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sale"."orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."order_items" ADD CONSTRAINT "order_items_quotation_item_id_quotation_items_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "sale"."quotation_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sale"."orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."orders" ADD CONSTRAINT "orders_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sale"."quotations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sale"."quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sale"."quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."quotations" ADD CONSTRAINT "quotations_previous_revision_id_quotations_id_fkey" FOREIGN KEY ("previous_revision_id") REFERENCES "sale"."quotations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sale"."returns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale"."return_items" ADD CONSTRAINT "return_items_delivery_note_item_id_delivery_note_items_id_fkey" FOREIGN KEY ("delivery_note_item_id") REFERENCES "sale"."delivery_note_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."return_items" ADD CONSTRAINT "return_items_order_item_id_order_items_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "sale"."order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."returns" ADD CONSTRAINT "returns_delivery_note_id_delivery_notes_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "sale"."delivery_notes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sale"."returns" ADD CONSTRAINT "returns_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sale"."orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "supplier"."addresses" ADD CONSTRAINT "addresses_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"."suppliers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "supplier"."company_addresses" ADD CONSTRAINT "company_addresses_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "supplier"."companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "supplier"."suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "supplier"."companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tax"."corrections" ADD CONSTRAINT "corrections_tax_record_id_records_id_fkey" FOREIGN KEY ("tax_record_id") REFERENCES "tax"."records"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tax"."records" ADD CONSTRAINT "records_tax_type_id_taxes_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax"."taxes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD CONSTRAINT "withholding_tax_records_tax_type_id_taxes_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax"."taxes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ticket"."ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"."tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket"."tickets" ADD CONSTRAINT "tickets_parent_ticket_id_tickets_id_fkey" FOREIGN KEY ("parent_ticket_id") REFERENCES "ticket"."tickets"("id") ON DELETE SET NULL;