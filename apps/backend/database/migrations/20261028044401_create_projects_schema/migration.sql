CREATE SCHEMA "projects";
--> statement-breakpoint
CREATE TABLE "projects"."project_costs" (
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
	CONSTRAINT "project_costs_category_check" CHECK ("category" IN ('material', 'transport', 'accommodation', 'subcontract', 'other')),
	CONSTRAINT "project_costs_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "projects"."project_evidence" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"note" varchar(500),
	"uploaded_by" text NOT NULL,
	"deleted_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "project_evidence_kind_check" CHECK ("kind" IN ('testing', 'training', 'bast', 'photo', 'other')),
	CONSTRAINT "project_evidence_size_check" CHECK ("size_bytes" > 0)
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
CREATE TABLE "projects"."project_tasks" (
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
	CONSTRAINT "project_tasks_status_check" CHECK ("status" IN ('todo', 'in_progress', 'done')),
	CONSTRAINT "project_tasks_stage_check" CHECK (stage IN ('preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty'))
);
--> statement-breakpoint
CREATE TABLE "projects"."projects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_code" varchar(32) NOT NULL,
	"quotation_code" varchar(40),
	"customer_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"title" text NOT NULL,
	"site_name" varchar(200),
	"contract_value" bigint DEFAULT 0 NOT NULL,
	"pic_user_id" text NOT NULL,
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
CREATE INDEX "project_costs_project_date_idx" ON "projects"."project_costs" ("project_id","cost_date");--> statement-breakpoint
CREATE INDEX "project_evidence_project_kind_idx" ON "projects"."project_evidence" ("project_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "project_handover_code_uq" ON "projects"."project_handover" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "project_handover_project_id_idx" ON "projects"."project_handover" ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_project_position_idx" ON "projects"."project_tasks" ("project_id","position");--> statement-breakpoint
CREATE INDEX "project_tasks_assignee_user_id_idx" ON "projects"."project_tasks" ("assignee_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_code_uq" ON "projects"."projects" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_live_sales_order_uq" ON "projects"."projects" ("sales_order_id") WHERE deleted_at IS NULL AND status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "projects_sales_order_id_idx" ON "projects"."projects" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "projects_customer_id_idx" ON "projects"."projects" ("customer_id");--> statement-breakpoint
CREATE INDEX "projects_pic_user_id_idx" ON "projects"."projects" ("pic_user_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects"."projects" ("status");
