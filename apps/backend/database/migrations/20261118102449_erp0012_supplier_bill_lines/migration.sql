CREATE TABLE "finance"."supplier_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"purchase_order_item_id" uuid,
	"item_id" uuid,
	"name" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"tax_base" bigint DEFAULT 0 NOT NULL,
	"is_stock" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "supplier_bill_items_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "supplier_bill_items_amounts_check" CHECK (unit_price >= 0 AND line_total >= 0 AND tax_base >= 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."supplier_bills" ADD COLUMN "supplier_invoice_number" varchar(100);--> statement-breakpoint
CREATE INDEX "supplier_bill_items_supplier_bill_id_idx" ON "finance"."supplier_bill_items" ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_items_purchase_order_item_id_idx" ON "finance"."supplier_bill_items" ("purchase_order_item_id");--> statement-breakpoint
ALTER TABLE "finance"."supplier_bill_items" ADD CONSTRAINT "supplier_bill_items_supplier_bill_id_supplier_bills_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "finance"."supplier_bills"("id") ON DELETE CASCADE;