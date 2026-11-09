CREATE SCHEMA "aftersales";
--> statement-breakpoint
CREATE TABLE "aftersales"."warranty_certificates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(80) NOT NULL,
	"project_id" uuid NOT NULL,
	"bast_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
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
	CONSTRAINT "warranty_certificates_months_check" CHECK ("months" BETWEEN 1 AND 120),
	CONSTRAINT "warranty_certificates_dates_check" CHECK ("end_date" >= "start_date")
);
--> statement-breakpoint
CREATE TABLE "projects"."project_handover" (
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
	CONSTRAINT "project_handover_status_check" CHECK ("status" IN ('issued', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "warranty_certificates_code_uq" ON "aftersales"."warranty_certificates" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warranty_certificates_live_project_uq" ON "aftersales"."warranty_certificates" ("project_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warranty_certificates_customer_id_idx" ON "aftersales"."warranty_certificates" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_handover_code_uq" ON "projects"."project_handover" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "project_handover_project_id_idx" ON "projects"."project_handover" ("project_id");