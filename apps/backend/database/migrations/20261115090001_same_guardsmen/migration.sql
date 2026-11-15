CREATE TABLE "accounting"."report_archives" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
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
CREATE UNIQUE INDEX "report_archives_scope_uq" ON "accounting"."report_archives" ("organization_id","period_year","period_month","report_type");