-- ERP-0047 Phase 1: the `notification` schema.
-- Hand-written, append-only (same convention as 20261113090000: no
-- snapshot.json, the repo carries no drizzle-kit journal).
--
-- Module 27 (ADR-0016). notification_templates and notifications leave the
-- tenant-scoped `automation` schema; they were never migrated there, so this
-- creates them new under `notification`.
--
-- App-scope: no organization_id. A notification belongs to one user
-- (user_id, a logical reference to auth.users.id) and is readable from every
-- organization that user belongs to; organization context travels as a tag
-- (the organization name) inside `tags`. There is no tenant to scope, so the
-- only unique index has no tenant split.

CREATE SCHEMA IF NOT EXISTS "notification";

CREATE TABLE IF NOT EXISTS "notification"."notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL DEFAULT 'in_app',
	"subject_template" text,
	"body_template" text NOT NULL,
	"variables" jsonb,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "notification_templates_channel_check"
		CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook'))
);

-- `module.event` code, unique across the whole app: one template serves every
-- organization. Partial so an archived template does not block a re-created one.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_code_uq"
	ON "notification"."notification_templates" ("code")
	WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "notification_templates_channel_idx"
	ON "notification"."notification_templates" ("channel");

CREATE TABLE IF NOT EXISTS "notification"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"notification_template_id" uuid,
	"user_id" text NOT NULL,
	"template_code" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"variables" jsonb,
	"metadata" jsonb,
	"channel" text NOT NULL DEFAULT 'in_app',
	"status" text NOT NULL DEFAULT 'sent',
	"sent_at" bigint,
	"read_at" bigint,
	"source_type" text,
	"source_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "notifications_channel_check"
		CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook')),
	CONSTRAINT "notifications_status_check"
		CHECK ("status" IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);

-- Intra-module FK. `set null` so a deleted template never erases delivery
-- history; the row still carries its own `template_code` for rendering.
ALTER TABLE "notification"."notifications"
	ADD CONSTRAINT "notifications_notification_template_id_fk"
	FOREIGN KEY ("notification_template_id")
	REFERENCES "notification"."notification_templates"("id")
	ON DELETE SET NULL ON UPDATE NO ACTION;

-- The list endpoint filters on user_id only, newest first.
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx"
	ON "notification"."notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_user_status_idx"
	ON "notification"."notifications" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "notifications_status_idx"
	ON "notification"."notifications" ("status");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx"
	ON "notification"."notifications" ("created_at");
CREATE INDEX IF NOT EXISTS "notifications_template_id_idx"
	ON "notification"."notifications" ("notification_template_id");
