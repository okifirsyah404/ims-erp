CREATE TABLE "procurement"."goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"stock_movement_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "goods_receipt_items_amounts_check" CHECK ("quantity" > 0 AND "unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
	"status" text DEFAULT 'posted' NOT NULL,
	"receipt_date" date NOT NULL,
	"supplier_delivery_ref" varchar(100),
	"received_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "goods_receipts_status_check" CHECK ("status" IN ('posted'))
);
--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD COLUMN "average_cost" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD COLUMN "total_value" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD COLUMN "unit_cost" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "procurement"."goods_receipt_items" ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_purchase_order_item_id_idx" ON "procurement"."goods_receipt_items" ("purchase_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_code_uq" ON "procurement"."goods_receipts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "procurement"."goods_receipts" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_warehouse_id_idx" ON "procurement"."goods_receipts" ("warehouse_id");--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_goods_receipts_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "procurement"."goods_receipts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_LfHoAU3Xn983_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "procurement"."purchase_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE RESTRICT;