CREATE SCHEMA "ticket";
--> statement-breakpoint
CREATE TABLE "ticket"."code_numberings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code_type" varchar(32) NOT NULL,
	"pattern" varchar(100),
	"reset_policy" text,
	"period_key" varchar(7) NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "ticket_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "ticket_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "ticket"."ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"ticket_id" uuid NOT NULL,
	"author_type" text DEFAULT 'staff' NOT NULL,
	"author_user_id" text,
	"author_name" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "ticket_messages_visibility_check" CHECK (visibility IN ('internal', 'customer')),
	CONSTRAINT "ticket_messages_author_type_check" CHECK (author_type IN ('staff', 'customer')),
	CONSTRAINT "ticket_messages_customer_visible_check" CHECK (author_type = 'staff' OR visibility = 'customer')
);
--> statement-breakpoint
CREATE TABLE "ticket"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "ticket_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "ticket"."tickets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"ticket_type" text DEFAULT 'other' NOT NULL,
	"parent_ticket_id" uuid,
	"ticket_template_id" uuid,
	"customer_id" uuid,
	"company_id" uuid,
	"customer_name" text NOT NULL,
	"project_id" uuid,
	"warranty_id" uuid,
	"item_serial_id" uuid,
	"serial_number" varchar(100),
	"device_description" varchar(300),
	"channel" text DEFAULT 'phone' NOT NULL,
	"reporter_name" varchar(200) NOT NULL,
	"reporter_contact" varchar(200),
	"complaint" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"reported_at" bigint NOT NULL,
	"in_warranty" boolean DEFAULT false NOT NULL,
	"warranty_ends_on" date,
	"warranty_code" varchar(80),
	"status" text DEFAULT 'new' NOT NULL,
	"assignee_user_id" text,
	"resolution" text,
	"service_cost" bigint DEFAULT 0 NOT NULL,
	"resolved_by" text,
	"resolved_at" bigint,
	"confirmed_by_name" varchar(200),
	"confirmation_channel" text,
	"confirmed_at" bigint,
	"closed_by" text,
	"closed_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tickets_type_check" CHECK (ticket_type IN ('installation', 'repair', 'maintenance', 'warranty_service', 'inspection', 'other')),
	CONSTRAINT "tickets_status_check" CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
	CONSTRAINT "tickets_priority_check" CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "tickets_channel_check" CHECK (channel IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')),
	CONSTRAINT "tickets_confirmation_channel_check" CHECK (confirmation_channel IS NULL OR confirmation_channel IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')),
	CONSTRAINT "tickets_service_cost_check" CHECK (service_cost >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_code_numberings_type_uq" ON "ticket"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_created_idx" ON "ticket"."ticket_messages" ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_settings_scope_uq" ON "ticket"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_code_uq" ON "ticket"."tickets" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tickets_customer_id_idx" ON "ticket"."tickets" ("customer_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_idx" ON "ticket"."tickets" ("company_id");--> statement-breakpoint
CREATE INDEX "tickets_project_id_idx" ON "ticket"."tickets" ("project_id");--> statement-breakpoint
CREATE INDEX "tickets_parent_ticket_id_idx" ON "ticket"."tickets" ("parent_ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_assignee_user_id_idx" ON "ticket"."tickets" ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "ticket"."tickets" ("status");--> statement-breakpoint
CREATE INDEX "tickets_serial_number_idx" ON "ticket"."tickets" ("serial_number");--> statement-breakpoint
ALTER TABLE "ticket"."ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"."tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket"."tickets" ADD CONSTRAINT "tickets_parent_ticket_id_tickets_id_fkey" FOREIGN KEY ("parent_ticket_id") REFERENCES "ticket"."tickets"("id") ON DELETE SET NULL;