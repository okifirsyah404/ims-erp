CREATE TABLE "finance"."project_budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"project_budget_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "project_budget_lines_amount_check" CHECK (amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."project_budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"project_id" uuid,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"control_mode" text DEFAULT 'warn' NOT NULL,
	"notes" text,
	"activated_by" text,
	"activated_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "project_budgets_status_check" CHECK (status IN ('draft', 'active', 'superseded')),
	CONSTRAINT "project_budgets_control_mode_check" CHECK (control_mode IN ('warn', 'block')),
	CONSTRAINT "project_budgets_version_check" CHECK (version > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."expense_claims" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_orders" ADD COLUMN "project_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "project_budget_lines_uq" ON "finance"."project_budget_lines" ("project_budget_id","account_id","period") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_budgets_version_uq" ON "finance"."project_budgets" ("organization_id","project_id","version") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_budgets_active_uq" ON "finance"."project_budgets" ("project_id") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "finance"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_project_budget_id_project_budgets_id_fkey" FOREIGN KEY ("project_budget_id") REFERENCES "finance"."project_budgets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finance"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_account_id_chart_of_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;