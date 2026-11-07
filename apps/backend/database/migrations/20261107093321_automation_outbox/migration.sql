CREATE SCHEMA "automation";
--> statement-breakpoint
CREATE TABLE "automation"."outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"topic" varchar(64) NOT NULL,
	"aggregate_type" varchar(64),
	"aggregate_id" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_attempt_at" bigint,
	"published_at" bigint,
	"response_status" smallint,
	"error_message" varchar(500),
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "outbox_messages_status_check" CHECK ("status" IN ('pending', 'published', 'failed')),
	CONSTRAINT "outbox_messages_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "outbox_messages_status_idx" ON "automation"."outbox_messages" ("status");--> statement-breakpoint
CREATE INDEX "outbox_messages_topic_idx" ON "automation"."outbox_messages" ("topic");--> statement-breakpoint
CREATE INDEX "outbox_messages_aggregate_idx" ON "automation"."outbox_messages" ("aggregate_type","aggregate_id");