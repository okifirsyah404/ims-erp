CREATE TABLE "sales"."order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"sales_order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" bigint NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sales"."sales_order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"sales_order_id" uuid NOT NULL,
	"quotation_item_id" uuid,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"quantity_delivered" numeric(18,3) DEFAULT '0' NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "sales_order_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0 AND "line_total" >= 0 AND "quantity_delivered" >= 0),
	CONSTRAINT "sales_order_items_fulfillment_status_check" CHECK ("fulfillment_status" IN ('pending', 'reserved', 'partial', 'fulfilled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sales"."sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"quotation_id" uuid NOT NULL,
	"quotation_code" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"customer_po_number" varchar(100),
	"title" text NOT NULL,
	"attention" varchar(200),
	"status" text DEFAULT 'confirmed' NOT NULL,
	"order_date" date NOT NULL,
	"delivery_date" date,
	"payment_terms" varchar(300),
	"payment_schedule" jsonb,
	"guarantee" varchar(300),
	"vat_enabled" boolean NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"sales_person_user_id" text,
	"notes" text,
	"created_by" text,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancellation_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "sales_orders_status_check" CHECK ("status" IN ('confirmed', 'in_progress', 'delivered', 'completed', 'cancelled')),
	CONSTRAINT "sales_orders_vat_rate_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000),
	CONSTRAINT "sales_orders_amounts_check" CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "grand_total" >= 0)
);
--> statement-breakpoint
CREATE INDEX "order_status_history_sales_order_id_idx" ON "sales"."order_status_history" ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_order_items_order_sort_idx" ON "sales"."sales_order_items" ("sales_order_id","sort_order");--> statement-breakpoint
CREATE INDEX "sales_order_items_fulfillment_status_idx" ON "sales"."sales_order_items" ("fulfillment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_code_uq" ON "sales"."sales_orders" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_live_quotation_uq" ON "sales"."sales_orders" ("quotation_id") WHERE deleted_at IS NULL AND status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "sales_orders_quotation_id_idx" ON "sales"."sales_orders" ("quotation_id");--> statement-breakpoint
CREATE INDEX "sales_orders_customer_id_idx" ON "sales"."sales_orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales"."sales_orders" ("status");--> statement-breakpoint
CREATE INDEX "sales_orders_sales_person_idx" ON "sales"."sales_orders" ("sales_person_user_id");--> statement-breakpoint
ALTER TABLE "sales"."order_status_history" ADD CONSTRAINT "order_status_history_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_sales_orders_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales"."sales_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."sales_order_items" ADD CONSTRAINT "sales_order_items_quotation_item_id_quotation_items_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "sales"."quotation_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE RESTRICT;