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
CREATE INDEX "customer_contacts_customer_id_idx" ON "crm"."customer_contacts" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_uq" ON "crm"."customers" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "crm"."customers" ("name");--> statement-breakpoint
CREATE INDEX "customers_tax_id_idx" ON "crm"."customers" ("tax_id");--> statement-breakpoint
CREATE INDEX "customers_owner_user_id_idx" ON "crm"."customers" ("owner_user_id");--> statement-breakpoint
ALTER TABLE "crm"."customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id") ON DELETE RESTRICT;