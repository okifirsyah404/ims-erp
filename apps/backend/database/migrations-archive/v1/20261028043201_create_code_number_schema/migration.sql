CREATE SCHEMA "code_number";
--> statement-breakpoint
CREATE TABLE "code_number"."series" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"module" varchar(32) NOT NULL,
	"code_type" varchar(32) NOT NULL,
	"pattern" varchar(100),
	"reset_policy" text,
	"period_key" varchar(7) NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "series_reset_policy_check" CHECK ("reset_policy" IS NULL OR "reset_policy" IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "series_next_number_check" CHECK ("next_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "series_code_type_uq" ON "code_number"."series" ("code_type") WHERE deleted_at IS NULL;
