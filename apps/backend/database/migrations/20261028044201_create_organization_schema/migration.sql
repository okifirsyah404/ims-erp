CREATE SCHEMA "organization";
--> statement-breakpoint
CREATE TABLE "organization"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "settings_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "settings_scope_uq" ON "organization"."settings" ("organization_id","setting_group","setting_key") WHERE deleted_at IS NULL;
