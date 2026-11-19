CREATE SCHEMA "automation";
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "automation"."faq_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"question" varchar(300) NOT NULL,
	"answer" text NOT NULL,
	"keywords" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "automation"."outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
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
	"dedupe_key" varchar(200),
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "outbox_messages_status_check" CHECK ("status" IN ('pending', 'published', 'failed')),
	CONSTRAINT "outbox_messages_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "automation"."whatsapp_conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"chat_id" varchar(128) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"contact_name" varchar(200),
	"status" text DEFAULT 'assistant' NOT NULL,
	"handoff_reason" text,
	"handoff_at" bigint,
	"assigned_user_id" text,
	"lead_id" uuid,
	"last_message_at" bigint NOT NULL,
	"last_inbound_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "whatsapp_conversations_status_check" CHECK ("status" IN ('assistant', 'handoff', 'closed')),
	CONSTRAINT "whatsapp_conversations_handoff_reason_check" CHECK ("handoff_reason" IS NULL OR "handoff_reason" IN ('no_provider', 'not_found', 'human_requested', 'restricted', 'error'))
);
--> statement-breakpoint
CREATE TABLE "automation"."whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"author" text NOT NULL,
	"external_id" varchar(128),
	"body" text NOT NULL,
	"status" text NOT NULL,
	"faq_entry_id" uuid,
	"sent_by" text,
	"error_message" varchar(500),
	"attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "whatsapp_messages_direction_check" CHECK ("direction" IN ('inbound', 'outbound')),
	CONSTRAINT "whatsapp_messages_author_check" CHECK ("author" IN ('customer', 'assistant', 'admin', 'system')),
	CONSTRAINT "whatsapp_messages_status_check" CHECK ("status" IN ('received', 'processed', 'pending', 'sent', 'failed')),
	CONSTRAINT "whatsapp_messages_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."web_listings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"item_id" uuid,
	"slug" varchar(120) NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" bigint,
	"specs" varchar(400),
	"price_mode" text DEFAULT 'list' NOT NULL,
	"price_caption" varchar(120),
	"out_of_stock_mode" text DEFAULT 'request' NOT NULL,
	"lead_time_label" varchar(60),
	"applications" jsonb DEFAULT '[]' NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "web_listings_price_mode_check" CHECK ("price_mode" IN ('list', 'rfq')),
	CONSTRAINT "web_listings_out_of_stock_mode_check" CHECK ("out_of_stock_mode" IN ('out', 'preorder', 'request')),
	CONSTRAINT "web_listings_popularity_check" CHECK ("popularity" >= 0)
);
--> statement-breakpoint
CREATE INDEX "faq_entries_is_active_idx" ON "automation"."faq_entries" ("is_active");--> statement-breakpoint
CREATE INDEX "outbox_messages_status_idx" ON "automation"."outbox_messages" ("status");--> statement-breakpoint
CREATE INDEX "outbox_messages_topic_idx" ON "automation"."outbox_messages" ("topic");--> statement-breakpoint
CREATE INDEX "outbox_messages_aggregate_idx" ON "automation"."outbox_messages" ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_messages_dedupe_key_key" ON "automation"."outbox_messages" ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_conversations_chat_id_key" ON "automation"."whatsapp_conversations" ("chat_id");--> statement-breakpoint
CREATE INDEX "whatsapp_conversations_status_idx" ON "automation"."whatsapp_conversations" ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_conversation_idx" ON "automation"."whatsapp_messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_direction_external_id_key" ON "automation"."whatsapp_messages" ("direction","external_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_status_idx" ON "automation"."whatsapp_messages" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "web_listings_slug_uq" ON "catalog"."web_listings" ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "web_listings_item_uq" ON "catalog"."web_listings" ("item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "web_listings_published_idx" ON "catalog"."web_listings" ("is_published");--> statement-breakpoint
ALTER TABLE "automation"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_3jpsZTHEO1Jd_fkey" FOREIGN KEY ("conversation_id") REFERENCES "automation"."whatsapp_conversations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "automation"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_faq_entry_id_faq_entries_id_fkey" FOREIGN KEY ("faq_entry_id") REFERENCES "automation"."faq_entries"("id") ON DELETE SET NULL;