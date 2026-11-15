CREATE TABLE "procurement"."purchase_return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_return_id" uuid NOT NULL,
	"goods_receipt_item_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"stock_movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_return_items_amounts_check" CHECK ("quantity" > 0 AND "unit_cost" >= 0 AND "line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32),
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
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
	"shipped_by" text,
	"shipped_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_returns_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'shipped', 'cancelled')),
	CONSTRAINT "purchase_returns_total_check" CHECK ("total_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "purchase_return_items_purchase_return_id_idx" ON "procurement"."purchase_return_items" ("purchase_return_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_goods_receipt_item_id_idx" ON "procurement"."purchase_return_items" ("goods_receipt_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_returns_code_uq" ON "procurement"."purchase_returns" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_returns_goods_receipt_id_idx" ON "procurement"."purchase_returns" ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_purchase_order_id_idx" ON "procurement"."purchase_returns" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_status_idx" ON "procurement"."purchase_returns" ("status");--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_Ixkuf3GYrG7c_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "procurement"."purchase_returns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_zWIWs6D5BjYk_fkey" FOREIGN KEY ("goods_receipt_item_id") REFERENCES "procurement"."goods_receipt_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_yhMa9BsZjRyG_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "procurement"."purchase_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_goods_receipt_id_goods_receipts_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "procurement"."goods_receipts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "procurement"."suppliers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" DROP CONSTRAINT "serial_tracked_items_status_check", ADD CONSTRAINT "serial_tracked_items_status_check" CHECK (status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned'));