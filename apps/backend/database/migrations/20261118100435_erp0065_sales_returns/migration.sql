CREATE TABLE "sales"."sales_return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"sales_return_id" uuid NOT NULL,
	"delivery_note_item_id" uuid NOT NULL,
	"sales_order_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sku" varchar(64),
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"condition" text,
	"bin_id" uuid,
	"stock_movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "sales_return_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "unit_cost" >= 0 AND "line_total" >= 0),
	CONSTRAINT "sales_return_items_condition_check" CHECK ("condition" IS NULL OR "condition" IN ('good', 'damaged'))
);
--> statement-breakpoint
CREATE TABLE "sales"."sales_returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32),
	"delivery_note_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"customer_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"return_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"rejection_reason" text,
	"created_by" text,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"received_by" text,
	"received_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "sales_returns_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'received', 'cancelled')),
	CONSTRAINT "sales_returns_total_check" CHECK ("total_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "sales_return_items_sales_return_id_idx" ON "sales"."sales_return_items" ("sales_return_id");--> statement-breakpoint
CREATE INDEX "sales_return_items_delivery_note_item_id_idx" ON "sales"."sales_return_items" ("delivery_note_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_returns_code_uq" ON "sales"."sales_returns" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sales_returns_delivery_note_id_idx" ON "sales"."sales_returns" ("delivery_note_id");--> statement-breakpoint
CREATE INDEX "sales_returns_sales_order_id_idx" ON "sales"."sales_returns" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_returns_status_idx" ON "sales"."sales_returns" ("status");--> statement-breakpoint
ALTER TABLE "sales"."sales_return_items" ADD CONSTRAINT "sales_return_items_sales_return_id_sales_returns_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales"."sales_returns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."sales_return_items" ADD CONSTRAINT "sales_return_items_lKRQ4PNV7mYt_fkey" FOREIGN KEY ("delivery_note_item_id") REFERENCES "sales"."delivery_note_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sales_return_items" ADD CONSTRAINT "sales_return_items_qXzQPvdbbsuJ_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales"."sales_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sales_returns" ADD CONSTRAINT "sales_returns_delivery_note_id_delivery_notes_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "sales"."delivery_notes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sales_returns" ADD CONSTRAINT "sales_returns_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" DROP CONSTRAINT "serial_tracked_items_status_check", ADD CONSTRAINT "serial_tracked_items_status_check" CHECK (status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'));