-- ERP-0042 (2/3): the `code_number` schema.
-- Hand-written, append-only (same convention as 20261113090000).
--
-- The numbering authority (ERP-0009) moves out of `organization`:
--   organization.document_sequences -> code_number.series
--   column document_type            -> code_type
-- Data is copied verbatim (period keys and counters survive), then the old
-- table is dropped.

CREATE SCHEMA IF NOT EXISTS "code_number";

CREATE TABLE IF NOT EXISTS "code_number"."series" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"module" varchar(32) NOT NULL,
	"code_type" varchar(32) NOT NULL,
	"pattern" varchar(100),
	"reset_policy" text,
	"period_key" varchar(7) NOT NULL,
	"next_number" bigint NOT NULL DEFAULT 1,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "series_reset_policy_check"
		CHECK ("reset_policy" IS NULL OR "reset_policy" IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "series_next_number_check" CHECK ("next_number" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "series_code_type_uq"
	ON "code_number"."series" ("code_type")
	WHERE "deleted_at" IS NULL;

INSERT INTO "code_number"."series" (
	"id", "module", "code_type", "pattern", "reset_policy", "period_key",
	"next_number", "updated_by", "created_at", "updated_at", "deleted_at"
)
SELECT
	"id", "module", "document_type", "pattern", "reset_policy", "period_key",
	"next_number", "updated_by", "created_at", "updated_at", "deleted_at"
FROM "organization"."document_sequences"
WHERE NOT EXISTS (SELECT 1 FROM "code_number"."series");

DROP TABLE IF EXISTS "organization"."document_sequences";
