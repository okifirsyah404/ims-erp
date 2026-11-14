CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE TABLE "crm"."customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"email" text,
	"phone" varchar(30),
	"whatsapp" varchar(30),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "crm"."customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"customer_type" text DEFAULT 'company' NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" varchar(16),
	"email" text,
	"phone" varchar(30),
	"whatsapp" varchar(30),
	"address_line" text,
	"village_id" uuid,
	"postal_code" varchar(10),
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" text,
	"portal_identity_id" uuid,
	"default_currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "customers_customer_type_check" CHECK ("customer_type" IN ('individual', 'company', 'government', 'partner')),
	CONSTRAINT "customers_status_check" CHECK ("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "crm"."lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"lead_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"notes" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"created_by" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "lead_activities_type_check" CHECK ("activity_type" IN ('call', 'whatsapp', 'email', 'meeting', 'survey', 'note'))
);
--> statement-breakpoint
CREATE TABLE "crm"."lead_attachments" (
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
CREATE TABLE "crm"."leads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"company_name" text,
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
CREATE INDEX "customer_contacts_customer_id_idx" ON "crm"."customer_contacts" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_uq" ON "crm"."customers" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "crm"."customers" ("name");--> statement-breakpoint
CREATE INDEX "customers_tax_id_idx" ON "crm"."customers" ("tax_id");--> statement-breakpoint
CREATE INDEX "customers_owner_user_id_idx" ON "crm"."customers" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_id_idx" ON "crm"."lead_activities" ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lead_attachments_lead_id_idx" ON "crm"."lead_attachments" ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_owner_user_id_idx" ON "crm"."leads" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "crm"."leads" ("status");--> statement-breakpoint
CREATE INDEX "leads_next_follow_up_at_idx" ON "crm"."leads" ("next_follow_up_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_reference_uq" ON "crm"."leads" ("reference") WHERE reference IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_idempotency_key_uq" ON "crm"."leads" ("idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
ALTER TABLE "crm"."customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "crm"."lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "crm"."lead_attachments" ADD CONSTRAINT "lead_attachments_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id") ON DELETE RESTRICT;
