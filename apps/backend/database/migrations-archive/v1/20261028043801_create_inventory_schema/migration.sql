CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."item_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"short_name" varchar(60),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"serial_number" text,
	"name" text NOT NULL,
	"description" text,
	"item_kind" text NOT NULL,
	"category_id" uuid,
	"brand" varchar(100),
	"specification" text,
	"image_object_key" text,
	"unit_label" varchar(32) DEFAULT 'pcs' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_serialized" boolean DEFAULT false NOT NULL,
	"is_stock_tracked" boolean DEFAULT true NOT NULL,
	"min_stock_qty" numeric(18,3) DEFAULT '0' NOT NULL,
	"barcode" text,
	"selling_price" bigint DEFAULT 0 NOT NULL,
	"purchase_price" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "inventory_items_kind_check" CHECK (item_kind IN ('product', 'component', 'material')),
	CONSTRAINT "inventory_items_prices_check" CHECK (selling_price >= 0 AND purchase_price >= 0),
	CONSTRAINT "inventory_items_min_stock_check" CHECK (min_stock_qty >= 0),
	CONSTRAINT "inventory_items_unit_label_check" CHECK (unit_label IN ('pcs', 'unit', 'set', 'paket', 'titik', 'm', 'roll', 'kg', 'jam', 'bulan', 'tahun', 'lic', 'lot', 'pulau'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."serial_tracked_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"is_provisional_serial" boolean DEFAULT false NOT NULL,
	"asset_tag" text,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"acquired_on" date,
	"warranty_expires_on" date,
	"purchase_order_line_id" text,
	"customer_id" uuid,
	"stock_movement_id" uuid,
	"current_borrowing_line_id" uuid,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "serial_tracked_items_status_check" CHECK (status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty')),
	CONSTRAINT "serial_tracked_items_provisional_check" CHECK (is_provisional_serial = false OR status = 'pre_order'),
	CONSTRAINT "serial_tracked_items_warranty_check" CHECK (warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_adjustment_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"stock_adjustment_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity_before" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_after" numeric(18,3) DEFAULT '0' NOT NULL,
	"unit_cost" bigint,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "stock_adjustment_items_before_check" CHECK (quantity_before >= 0),
	CONSTRAINT "stock_adjustment_items_after_check" CHECK (quantity_after >= 0),
	CONSTRAINT "stock_adjustment_items_unit_cost_check" CHECK (unit_cost IS NULL OR unit_cost >= 0)
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
CREATE TABLE "inventory"."stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity_on_hand" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_reserved" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_available" numeric(18,3) DEFAULT '0' NOT NULL,
	"average_cost" bigint DEFAULT 0 NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"last_movement_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "stock_balances_available_check" CHECK (quantity_available = quantity_on_hand - quantity_reserved),
	CONSTRAINT "stock_balances_on_hand_check" CHECK (quantity_on_hand >= 0),
	CONSTRAINT "stock_balances_reserved_check" CHECK (quantity_reserved >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"movement_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"bin_id" uuid,
	"target_warehouse_id" uuid,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"occurred_at" bigint NOT NULL,
	"created_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "stock_movements_type_check" CHECK (movement_type IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'consumption', 'borrowing_out', 'borrowing_in')),
	CONSTRAINT "stock_movements_status_check" CHECK (status IN ('draft', 'posted', 'reversed')),
	CONSTRAINT "stock_movements_quantity_check" CHECK (quantity <> 0),
	CONSTRAINT "stock_movements_transfer_target_check" CHECK ((movement_type IN ('transfer_in', 'transfer_out') AND target_warehouse_id IS NOT NULL) OR (movement_type NOT IN ('transfer_in', 'transfer_out'))),
	CONSTRAINT "stock_movements_borrowing_reference_check" CHECK ((movement_type IN ('borrowing_out', 'borrowing_in') AND reference_type = 'borrowing') OR (movement_type NOT IN ('borrowing_out', 'borrowing_in')))
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"label" text,
	"street" text NOT NULL,
	"rt" varchar(8),
	"rw" varchar(8),
	"postal_code" varchar(10),
	"village_id" uuid,
	"latitude" numeric(10,7),
	"longitude" numeric(10,7),
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_managers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"user_id" text,
	"assigned_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse_storages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text,
	"bin_type" text,
	"capacity" numeric(18,3),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"responsible_employee_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE UNIQUE INDEX "item_categories_slug_uq" ON "inventory"."item_categories" ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_org_code_uq" ON "inventory"."items" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_global_code_uq" ON "inventory"."items" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_org_sku_uq" ON "inventory"."items" ("organization_id","sku") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_global_sku_uq" ON "inventory"."items" ("sku") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_items_kind_idx" ON "inventory"."items" ("item_kind");--> statement-breakpoint
CREATE INDEX "inventory_items_org_name_idx" ON "inventory"."items" ("organization_id","name");--> statement-breakpoint
CREATE INDEX "inventory_items_barcode_idx" ON "inventory"."items" ("barcode");--> statement-breakpoint
CREATE INDEX "inventory_items_category_id_idx" ON "inventory"."items" ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serial_tracked_items_org_serial_uq" ON "inventory"."serial_tracked_items" ("organization_id","serial_number") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "serial_tracked_items_global_serial_uq" ON "inventory"."serial_tracked_items" ("serial_number") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "serial_tracked_items_item_id_idx" ON "inventory"."serial_tracked_items" ("item_id");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_status_idx" ON "inventory"."serial_tracked_items" ("status");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_warehouse_id_idx" ON "inventory"."serial_tracked_items" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_asset_tag_idx" ON "inventory"."serial_tracked_items" ("asset_tag");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_current_borrowing_line_id_idx" ON "inventory"."serial_tracked_items" ("current_borrowing_line_id");--> statement-breakpoint
CREATE INDEX "stock_adjustment_items_adjustment_id_idx" ON "inventory"."stock_adjustment_items" ("stock_adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_org_code_uq" ON "inventory"."stock_adjustments" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "stock_adjustments_warehouse_id_idx" ON "inventory"."stock_adjustments" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_status_idx" ON "inventory"."stock_adjustments" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_org_scope_uq" ON "inventory"."stock_balances" ("organization_id","warehouse_id","item_id","bin_id") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_global_scope_uq" ON "inventory"."stock_balances" ("warehouse_id","item_id","bin_id") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "stock_balances_item_id_idx" ON "inventory"."stock_balances" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_org_code_uq" ON "inventory"."stock_movements" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_global_code_uq" ON "inventory"."stock_movements" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "stock_movements_ledger_idx" ON "inventory"."stock_movements" ("organization_id","item_id","warehouse_id","occurred_at");--> statement-breakpoint
CREATE INDEX "stock_movements_bin_id_idx" ON "inventory"."stock_movements" ("bin_id");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_type_idx" ON "inventory"."stock_movements" ("reference_type");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_id_idx" ON "inventory"."stock_movements" ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_addresses_warehouse_uq" ON "inventory"."warehouse_addresses" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_addresses_village_id_idx" ON "inventory"."warehouse_addresses" ("village_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_managers_uq" ON "inventory"."warehouse_managers" ("warehouse_id","user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_managers_user_id_idx" ON "inventory"."warehouse_managers" ("user_id");--> statement-breakpoint
CREATE INDEX "warehouse_organizations_warehouse_id_idx" ON "inventory"."warehouse_organizations" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_organizations_organization_id_idx" ON "inventory"."warehouse_organizations" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_organizations_uq" ON "inventory"."warehouse_organizations" ("warehouse_id","organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_storages_warehouse_id_idx" ON "inventory"."warehouse_storages" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_storages_warehouse_code_uq" ON "inventory"."warehouse_storages" ("warehouse_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_code_uq" ON "inventory"."warehouses" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_code_uq" ON "inventory"."warehouses" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "warehouses_is_default_idx" ON "inventory"."warehouses" ("is_default");--> statement-breakpoint
CREATE INDEX "warehouses_is_active_idx" ON "inventory"."warehouses" ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_default_uq" ON "inventory"."warehouses" ("organization_id") WHERE organization_id IS NOT NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_default_uq" ON "inventory"."warehouses" (coalesce("organization_id", '00000000-0000-0000-0000-000000000000')) WHERE organization_id IS NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_category_id_item_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory"."item_categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_Gis6x14AGR5M_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "inventory"."stock_adjustments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_target_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("target_warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_addresses" ADD CONSTRAINT "warehouse_addresses_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_managers" ADD CONSTRAINT "warehouse_managers_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_organizations" ADD CONSTRAINT "warehouse_organizations_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_storages" ADD CONSTRAINT "warehouse_storages_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;

--> statement-breakpoint
-- Hand-written: drizzle-kit's index builder cannot express either of these.
-- 1. Both stock_balances scope indexes are NULLS NOT DISTINCT in Postgres so a
--    balance without a storage bin is ONE row per (scope, warehouse, item).
--    Plain unique indexes treat NULLs as distinct, which made every ON CONFLICT
--    upsert of a bin-less balance insert a new row (fixed by 20261105185010,
--    see the comment in inventory.schema.ts).
-- 2. The items code indexes carry `deleted_at IS NULL`, matching the
--    soft-delete convention used by every other code index in the database.
DROP INDEX "inventory"."stock_balances_org_scope_uq";--> statement-breakpoint
DROP INDEX "inventory"."stock_balances_global_scope_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_org_scope_uq" ON "inventory"."stock_balances" ("organization_id","warehouse_id","item_id","bin_id") NULLS NOT DISTINCT WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_global_scope_uq" ON "inventory"."stock_balances" ("warehouse_id","item_id","bin_id") NULLS NOT DISTINCT WHERE organization_id IS NULL;--> statement-breakpoint
DROP INDEX "inventory"."inventory_items_org_code_uq";--> statement-breakpoint
DROP INDEX "inventory"."inventory_items_global_code_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_org_code_uq" ON "inventory"."items" ("organization_id","code") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_global_code_uq" ON "inventory"."items" ("code") WHERE deleted_at IS NULL AND organization_id IS NULL;

