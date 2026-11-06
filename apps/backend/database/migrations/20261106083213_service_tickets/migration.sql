CREATE TABLE "aftersales"."service_tickets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"project_id" uuid,
	"serial_number" varchar(100),
	"device_description" varchar(300),
	"channel" text DEFAULT 'phone' NOT NULL,
	"reporter_name" varchar(200) NOT NULL,
	"reporter_contact" varchar(200),
	"complaint" text NOT NULL,
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
	CONSTRAINT "service_tickets_status_check" CHECK ("status" IN ('new', 'in_progress', 'resolved', 'closed')),
	CONSTRAINT "service_tickets_channel_check" CHECK ("channel" IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'other')),
	CONSTRAINT "service_tickets_confirmation_channel_check" CHECK ("confirmation_channel" IS NULL OR "confirmation_channel" IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'other')),
	CONSTRAINT "service_tickets_service_cost_check" CHECK ("service_cost" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_tickets_code_uq" ON "aftersales"."service_tickets" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "service_tickets_customer_id_idx" ON "aftersales"."service_tickets" ("customer_id");--> statement-breakpoint
CREATE INDEX "service_tickets_project_id_idx" ON "aftersales"."service_tickets" ("project_id");--> statement-breakpoint
CREATE INDEX "service_tickets_assignee_user_id_idx" ON "aftersales"."service_tickets" ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "service_tickets_status_idx" ON "aftersales"."service_tickets" ("status");--> statement-breakpoint
CREATE INDEX "service_tickets_serial_number_idx" ON "aftersales"."service_tickets" ("serial_number");