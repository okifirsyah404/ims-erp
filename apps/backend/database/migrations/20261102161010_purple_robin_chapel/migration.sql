CREATE TABLE "inventory"."stock_adjustment_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"stock_adjustment_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity_before" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_after" numeric(18,3) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "stock_adjustment_items_before_check" CHECK (quantity_before >= 0),
	CONSTRAINT "stock_adjustment_items_after_check" CHECK (quantity_after >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"adjustment_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reason_code" text,
	"notes" text,
	"requested_by" text,
	"requested_at" bigint NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"posted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "stock_adjustments_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled')),
	CONSTRAINT "stock_adjustments_type_check" CHECK (adjustment_type IN ('increase', 'decrease', 'recount')),
	CONSTRAINT "stock_adjustments_approval_check" CHECK ((status NOT IN ('approved', 'posted') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))),
	CONSTRAINT "stock_adjustments_posted_check" CHECK ((status <> 'posted' OR posted_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" DROP CONSTRAINT "stock_movements_unit_cost_check";--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" DROP COLUMN "average_cost";--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" DROP COLUMN "total_value";--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" DROP COLUMN "currency_code";--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" DROP COLUMN "unit_cost";--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" DROP COLUMN "currency_code";--> statement-breakpoint
CREATE INDEX "stock_adjustment_items_adjustment_id_idx" ON "inventory"."stock_adjustment_items" ("stock_adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_org_code_uq" ON "inventory"."stock_adjustments" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "stock_adjustments_warehouse_id_idx" ON "inventory"."stock_adjustments" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_status_idx" ON "inventory"."stock_adjustments" ("status");--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_Gis6x14AGR5M_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "inventory"."stock_adjustments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;