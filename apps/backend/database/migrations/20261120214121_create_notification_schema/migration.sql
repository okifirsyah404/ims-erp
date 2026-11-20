CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE TABLE "notification"."push_notification_templates" (
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
	CONSTRAINT "push_push_notification_templates_channel_check" CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook'))
);
--> statement-breakpoint
CREATE TABLE "notification"."push_notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"notification_template_id" uuid,
	"user_id" text,
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
	CONSTRAINT "push_notifications_channel_check" CHECK ("channel" IN ('email', 'whatsapp', 'in_app', 'webhook')),
	CONSTRAINT "push_notifications_status_check" CHECK ("status" IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "push_push_notification_templates_code_uq" ON "notification"."push_notification_templates" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "push_push_notification_templates_channel_idx" ON "notification"."push_notification_templates" ("channel");--> statement-breakpoint
CREATE INDEX "push_notifications_user_id_idx" ON "notification"."push_notifications" ("user_id");--> statement-breakpoint
CREATE INDEX "push_notifications_user_status_idx" ON "notification"."push_notifications" ("user_id","status");--> statement-breakpoint
CREATE INDEX "push_notifications_status_idx" ON "notification"."push_notifications" ("status");--> statement-breakpoint
CREATE INDEX "push_notifications_created_at_idx" ON "notification"."push_notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "push_notifications_template_id_idx" ON "notification"."push_notifications" ("notification_template_id");--> statement-breakpoint
ALTER TABLE "notification"."push_notifications" ADD CONSTRAINT "push_notifications_ukQEOqgriDD1_fkey" FOREIGN KEY ("notification_template_id") REFERENCES "notification"."push_notification_templates"("id") ON DELETE SET NULL;