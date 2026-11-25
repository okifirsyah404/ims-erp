CREATE TABLE "finance"."cash_forecast_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"expected_date" date NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"description" text NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "cash_forecast_lines_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "cash_forecast_lines_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE INDEX "cash_forecast_lines_date_idx" ON "finance"."cash_forecast_lines" ("organization_id","expected_date");