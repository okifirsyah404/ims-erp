CREATE TABLE "procurement"."purchase_request_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_request_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"estimated_unit_price" bigint DEFAULT 0 NOT NULL,
	"estimated_total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_request_items_amounts_check" CHECK ("quantity" > 0 AND "estimated_unit_price" >= 0 AND "estimated_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40),
	"organization_id" text,
	"requested_by" text,
	"requested_by_name" varchar(120),
	"subject" varchar(200) NOT NULL,
	"justification" text,
	"project_name" varchar(200),
	"request_date" date NOT NULL,
	"needed_by" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"estimated_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"rejection_reason" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_requests_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'ordered', 'cancelled')),
	CONSTRAINT "purchase_requests_estimated_total_check" CHECK ("estimated_total" >= 0),
	CONSTRAINT "purchase_requests_needed_by_check" CHECK ("needed_by" IS NULL OR "needed_by" >= "request_date")
);
--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD COLUMN "purchase_request_item_id" uuid;--> statement-breakpoint
CREATE INDEX "purchase_order_items_purchase_request_item_id_idx" ON "procurement"."purchase_order_items" ("purchase_request_item_id");--> statement-breakpoint
CREATE INDEX "purchase_request_items_request_sort_idx" ON "procurement"."purchase_request_items" ("purchase_request_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requests_code_uq" ON "procurement"."purchase_requests" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_requests_status_idx" ON "procurement"."purchase_requests" ("status");--> statement-breakpoint
CREATE INDEX "purchase_requests_requested_by_idx" ON "procurement"."purchase_requests" ("requested_by");--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_9wVPh1SlEHf2_fkey" FOREIGN KEY ("purchase_request_item_id") REFERENCES "procurement"."purchase_request_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_request_items" ADD CONSTRAINT "purchase_request_items_Ux9VGEdMFJ2l_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "procurement"."purchase_requests"("id") ON DELETE CASCADE;