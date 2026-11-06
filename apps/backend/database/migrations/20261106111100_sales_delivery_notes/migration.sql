CREATE TABLE "sales"."delivery_note_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"delivery_note_id" uuid NOT NULL,
	"sales_order_item_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint,
	"serial_numbers" jsonb,
	"remarks" text,
	"stock_movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "delivery_note_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."delivery_notes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
	"status" text DEFAULT 'prepared' NOT NULL,
	"delivery_date" date NOT NULL,
	"project_name" text,
	"project_location" text,
	"recipient_name" text NOT NULL,
	"recipient_address" text,
	"recipient_pic" varchar(200),
	"recipient_contact" varchar(200),
	"driver_name" varchar(200),
	"vehicle_number" varchar(32),
	"notes" text,
	"shipped_at" bigint,
	"shipped_by" text,
	"received_at" bigint,
	"receiver_name" text,
	"cancelled_at" bigint,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "delivery_notes_status_check" CHECK ("status" IN ('prepared', 'shipped', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX "delivery_note_items_delivery_note_id_idx" ON "sales"."delivery_note_items" ("delivery_note_id");--> statement-breakpoint
CREATE INDEX "delivery_note_items_sales_order_item_id_idx" ON "sales"."delivery_note_items" ("sales_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_notes_code_uq" ON "sales"."delivery_notes" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "delivery_notes_sales_order_id_idx" ON "sales"."delivery_notes" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_status_idx" ON "sales"."delivery_notes" ("status");--> statement-breakpoint
ALTER TABLE "sales"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_delivery_notes_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "sales"."delivery_notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_GizTnQCLjA1F_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales"."sales_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."delivery_notes" ADD CONSTRAINT "delivery_notes_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE RESTRICT;