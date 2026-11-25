CREATE TABLE "tax"."pph21_brackets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"lower_bound" bigint NOT NULL,
	"rate" numeric(7,4) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "pph21_brackets_lower_bound_check" CHECK (lower_bound >= 0),
	CONSTRAINT "pph21_brackets_rate_check" CHECK (rate >= 0 AND rate <= 100)
);
--> statement-breakpoint
CREATE TABLE "tax"."pph21_ptkp" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"status_code" varchar(5) NOT NULL,
	"annual_amount" bigint NOT NULL,
	"ter_category" varchar(1) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "pph21_ptkp_status_code_check" CHECK (status_code IN ('TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3')),
	CONSTRAINT "pph21_ptkp_ter_category_check" CHECK (ter_category IN ('A', 'B', 'C')),
	CONSTRAINT "pph21_ptkp_annual_amount_check" CHECK (annual_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "tax"."pph21_ter_rates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"category" varchar(1) NOT NULL,
	"lower_bound" bigint NOT NULL,
	"rate" numeric(7,4) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "pph21_ter_rates_category_check" CHECK (category IN ('A', 'B', 'C')),
	CONSTRAINT "pph21_ter_rates_lower_bound_check" CHECK (lower_bound >= 0),
	CONSTRAINT "pph21_ter_rates_rate_check" CHECK (rate >= 0 AND rate <= 100)
);
--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD COLUMN "tax_id" varchar(32);--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD COLUMN "ptkp_status" varchar(5);--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD COLUMN "bpjs_health_number" varchar(32);--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD COLUMN "bpjs_employment_number" varchar(32);--> statement-breakpoint
CREATE UNIQUE INDEX "pph21_brackets_bound_effective_uq" ON "tax"."pph21_brackets" ("lower_bound","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pph21_ptkp_status_effective_uq" ON "tax"."pph21_ptkp" ("status_code","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pph21_ter_rates_category_bound_uq" ON "tax"."pph21_ter_rates" ("category","lower_bound","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD CONSTRAINT "employees_ptkp_status_check" CHECK (ptkp_status IS NULL OR ptkp_status IN ('TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'));