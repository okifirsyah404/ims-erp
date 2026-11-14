CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE TABLE "notification"."notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"variables" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "notification_templates_channel_check" CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook'))
);
--> statement-breakpoint
CREATE TABLE "notification"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"notification_template_id" uuid,
	"user_id" text NOT NULL,
	"template_code" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"variables" jsonb,
	"metadata" jsonb,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" bigint,
	"read_at" bigint,
	"source_type" text,
	"source_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "notifications_channel_check" CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook')),
	CONSTRAINT "notifications_status_check" CHECK ("status" IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_code_uq" ON "notification"."notification_templates" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "notification_templates_channel_idx" ON "notification"."notification_templates" ("channel");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notification"."notifications" ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_status_idx" ON "notification"."notifications" ("user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notification"."notifications" ("status");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notification"."notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_template_id_idx" ON "notification"."notifications" ("notification_template_id");--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_XkCAPcznqa6Z_fkey" FOREIGN KEY ("notification_template_id") REFERENCES "notification"."notification_templates"("id") ON DELETE SET NULL;
