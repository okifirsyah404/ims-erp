CREATE SCHEMA "procurement";
--> statement-breakpoint
CREATE TABLE "procurement"."goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"movement_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "goods_receipt_items_amounts_check" CHECK (quantity > 0 AND unit_cost >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"status" text DEFAULT 'posted' NOT NULL,
	"receipt_date" date NOT NULL,
	"supplier_delivery_ref" varchar(100),
	"received_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "goods_receipts_status_check" CHECK (status IN ('posted'))
);
--> statement-breakpoint
CREATE TABLE "procurement"."code_numberings" (
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
	CONSTRAINT "procurement_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "procurement_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"quantity_received" numeric(18,3) DEFAULT '0' NOT NULL,
	"purchase_request_item_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_order_items_amounts_check" CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0 AND quantity_received >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40),
	"supplier_company_id" uuid,
	"supplier_pic_id" uuid,
	"supplier_snapshot" jsonb NOT NULL,
	"category" text NOT NULL,
	"subject" varchar(200) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"supplier_quote_ref" varchar(100),
	"supplier_quote_date" date,
	"project_name" varchar(200),
	"buyer_pic_name" varchar(120),
	"vat_mode" text DEFAULT 'none' NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"payment_terms" varchar(500),
	"terms" text,
	"notes" text,
	"rejection_reason" text,
	"created_by" text,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"sent_by" text,
	"sent_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_orders_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'sent', 'partially_received', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_category_check" CHECK (category IN ('hardware', 'software', 'service', 'other')),
	CONSTRAINT "purchase_orders_vat_mode_check" CHECK (vat_mode IN ('none', 'included', 'added')),
	CONSTRAINT "purchase_orders_vat_rate_check" CHECK (vat_rate_bps >= 0 AND vat_rate_bps <= 10000),
	CONSTRAINT "purchase_orders_amounts_check" CHECK (subtotal >= 0 AND tax_total >= 0 AND grand_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_request_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_request_id" uuid NOT NULL,
	"product_id" uuid,
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
	CONSTRAINT "purchase_request_items_amounts_check" CHECK (quantity > 0 AND estimated_unit_price >= 0 AND estimated_total >= 0)
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
	CONSTRAINT "purchase_requests_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'ordered', 'cancelled')),
	CONSTRAINT "purchase_requests_estimated_total_check" CHECK (estimated_total >= 0),
	CONSTRAINT "purchase_requests_needed_by_check" CHECK (needed_by IS NULL OR needed_by >= request_date)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_return_id" uuid NOT NULL,
	"goods_receipt_item_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"product_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"serial_numbers" jsonb,
	"movement_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_return_items_amounts_check" CHECK (quantity > 0 AND unit_cost >= 0 AND line_total >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32),
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_company_id" uuid,
	"warehouse_id" uuid,
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
	CONSTRAINT "purchase_returns_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'shipped', 'cancelled')),
	CONSTRAINT "purchase_returns_total_check" CHECK (total_amount >= 0)
);
--> statement-breakpoint
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "procurement"."goods_receipt_items" ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_purchase_order_item_id_idx" ON "procurement"."goods_receipt_items" ("purchase_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_code_uq" ON "procurement"."goods_receipts" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "procurement"."goods_receipts" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_warehouse_id_idx" ON "procurement"."goods_receipts" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_code_numberings_type_uq" ON "procurement"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "purchase_order_items_order_sort_idx" ON "procurement"."purchase_order_items" ("purchase_order_id","sort_order");--> statement-breakpoint
CREATE INDEX "purchase_order_items_purchase_request_item_id_idx" ON "procurement"."purchase_order_items" ("purchase_request_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_code_uq" ON "procurement"."purchase_orders" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_company_id_idx" ON "procurement"."purchase_orders" ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "procurement"."purchase_orders" ("status");--> statement-breakpoint
CREATE INDEX "purchase_request_items_request_sort_idx" ON "procurement"."purchase_request_items" ("purchase_request_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requests_code_uq" ON "procurement"."purchase_requests" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_requests_status_idx" ON "procurement"."purchase_requests" ("status");--> statement-breakpoint
CREATE INDEX "purchase_requests_requested_by_idx" ON "procurement"."purchase_requests" ("requested_by");--> statement-breakpoint
CREATE INDEX "purchase_return_items_purchase_return_id_idx" ON "procurement"."purchase_return_items" ("purchase_return_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_goods_receipt_item_id_idx" ON "procurement"."purchase_return_items" ("goods_receipt_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_returns_code_uq" ON "procurement"."purchase_returns" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_returns_goods_receipt_id_idx" ON "procurement"."purchase_returns" ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_purchase_order_id_idx" ON "procurement"."purchase_returns" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_status_idx" ON "procurement"."purchase_returns" ("status");--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_goods_receipts_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "procurement"."goods_receipts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_LfHoAU3Xn983_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "procurement"."purchase_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_9wVPh1SlEHf2_fkey" FOREIGN KEY ("purchase_request_item_id") REFERENCES "procurement"."purchase_request_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_request_items" ADD CONSTRAINT "purchase_request_items_Ux9VGEdMFJ2l_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "procurement"."purchase_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_Ixkuf3GYrG7c_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "procurement"."purchase_returns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_zWIWs6D5BjYk_fkey" FOREIGN KEY ("goods_receipt_item_id") REFERENCES "procurement"."goods_receipt_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_return_items" ADD CONSTRAINT "purchase_return_items_yhMa9BsZjRyG_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "procurement"."purchase_order_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_goods_receipt_id_goods_receipts_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "procurement"."goods_receipts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE RESTRICT;