CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_id" uuid NOT NULL,
	"borrowing_line_id" uuid,
	"event_type" text NOT NULL,
	"stock_movement_id" uuid,
	"actor_user_id" text,
	"occurred_at" bigint NOT NULL,
	"note" text,
	CONSTRAINT "borrowing_events_type_check" CHECK (event_type IN ('requested', 'approved', 'rejected', 'issued', 'returned', 'marked_late', 'marked_lost', 'due_date_extended', 'cancelled', 'closed')),
	CONSTRAINT "borrowing_events_movement_check" CHECK ((event_type IN ('issued', 'returned', 'marked_lost') AND stock_movement_id IS NOT NULL)
				OR (event_type NOT IN ('issued', 'returned', 'marked_lost') AND stock_movement_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_id" uuid NOT NULL,
	"serial_tracked_item_id" uuid NOT NULL,
	"origin_warehouse_id" uuid NOT NULL,
	"issued_at" bigint,
	"due_at" bigint,
	"returned_at" bigint,
	"returned_condition" text,
	"marked_late_at" bigint,
	"marked_lost_at" bigint,
	"lost_reported_by" text,
	"site_address_text" text,
	"project_id" uuid,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowing_lines_condition_check" CHECK (returned_condition IS NULL OR returned_condition IN ('good', 'damaged', 'incomplete')),
	CONSTRAINT "borrowing_lines_due_after_issue_check" CHECK (due_at IS NULL OR issued_at IS NULL OR due_at > issued_at)
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"purpose" text DEFAULT 'internal_use' NOT NULL,
	"borrower_type" text NOT NULL,
	"borrower_user_id" text,
	"borrower_customer_id" uuid,
	"guest_name" text,
	"guest_phone" text,
	"guest_id_type" text,
	"guest_id_number" text,
	"guest_address_text" text,
	"guest_id_document_ref" text,
	"requested_by" text,
	"requested_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"issued_by" text,
	"issued_at" bigint,
	"due_at" bigint NOT NULL,
	"closed_by" text,
	"closed_at" bigint,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowings_status_check" CHECK (status IN ('draft', 'requested', 'approved', 'rejected', 'issued', 'partially_returned', 'returned', 'closed', 'cancelled')),
	CONSTRAINT "borrowings_purpose_check" CHECK (purpose IN ('rental', 'internal_use', 'testing', 'warranty_service')),
	CONSTRAINT "borrowings_borrower_type_check" CHECK (borrower_type IN ('user', 'customer', 'guest')),
	CONSTRAINT "borrowings_guest_id_type_check" CHECK (guest_id_type IS NULL OR guest_id_type IN ('ktp', 'sim', 'passport', 'other')),
	CONSTRAINT "borrowings_borrower_identity_check" CHECK ((borrower_type = 'user' AND borrower_user_id IS NOT NULL AND borrower_customer_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'customer' AND borrower_customer_id IS NOT NULL AND borrower_user_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'guest' AND guest_name IS NOT NULL AND guest_phone IS NOT NULL AND guest_id_number IS NOT NULL AND borrower_user_id IS NULL AND borrower_customer_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"item_kind" text NOT NULL,
	"category" text,
	"unit_label" varchar(32),
	"is_serialized" boolean DEFAULT false NOT NULL,
	"is_stock_tracked" boolean DEFAULT true NOT NULL,
	"min_stock_qty" numeric(18,3) DEFAULT '0' NOT NULL,
	"barcode" text,
	"selling_price" bigint DEFAULT 0 NOT NULL,
	"purchase_price" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "inventory_items_kind_check" CHECK (item_kind IN ('product', 'component', 'material', 'tool', 'service')),
	CONSTRAINT "inventory_items_prices_check" CHECK (selling_price >= 0 AND purchase_price >= 0),
	CONSTRAINT "inventory_items_min_stock_check" CHECK (min_stock_qty >= 0),
	CONSTRAINT "inventory_items_service_not_stocked_check" CHECK (NOT (item_kind = 'service') OR (is_serialized = false AND is_stock_tracked = false))
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
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "serial_tracked_items_status_check" CHECK (status IN ('pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty')),
	CONSTRAINT "serial_tracked_items_provisional_check" CHECK (is_provisional_serial = false OR status = 'pre_order'),
	CONSTRAINT "serial_tracked_items_warranty_check" CHECK (warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on)
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
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"last_movement_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "stock_balances_available_check" CHECK (quantity_available = quantity_on_hand - quantity_reserved)
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
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
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
	CONSTRAINT "stock_movements_unit_cost_check" CHECK (unit_cost >= 0),
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
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE INDEX "borrowing_events_borrowing_occurred_idx" ON "inventory"."borrowing_events" ("borrowing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "borrowing_events_line_id_idx" ON "inventory"."borrowing_events" ("borrowing_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_lines_borrowing_unit_uq" ON "inventory"."borrowing_lines" ("borrowing_id","serial_tracked_item_id");--> statement-breakpoint
CREATE INDEX "borrowing_lines_unit_id_idx" ON "inventory"."borrowing_lines" ("serial_tracked_item_id");--> statement-breakpoint
CREATE INDEX "borrowing_lines_open_idx" ON "inventory"."borrowing_lines" ("due_at") WHERE returned_at IS NULL AND marked_lost_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_org_code_uq" ON "inventory"."borrowings" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_global_code_uq" ON "inventory"."borrowings" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "borrowings_status_idx" ON "inventory"."borrowings" ("status");--> statement-breakpoint
CREATE INDEX "borrowings_borrower_user_id_idx" ON "inventory"."borrowings" ("borrower_user_id");--> statement-breakpoint
CREATE INDEX "borrowings_borrower_customer_id_idx" ON "inventory"."borrowings" ("borrower_customer_id");--> statement-breakpoint
CREATE INDEX "borrowings_due_at_idx" ON "inventory"."borrowings" ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_org_sku_uq" ON "inventory"."items" ("organization_id","sku") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_global_sku_uq" ON "inventory"."items" ("sku") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_items_kind_idx" ON "inventory"."items" ("item_kind");--> statement-breakpoint
CREATE INDEX "inventory_items_org_name_idx" ON "inventory"."items" ("organization_id","name");--> statement-breakpoint
CREATE INDEX "inventory_items_barcode_idx" ON "inventory"."items" ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "serial_tracked_items_org_serial_uq" ON "inventory"."serial_tracked_items" ("organization_id","serial_number") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "serial_tracked_items_global_serial_uq" ON "inventory"."serial_tracked_items" ("serial_number") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "serial_tracked_items_item_id_idx" ON "inventory"."serial_tracked_items" ("item_id");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_status_idx" ON "inventory"."serial_tracked_items" ("status");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_warehouse_id_idx" ON "inventory"."serial_tracked_items" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "serial_tracked_items_asset_tag_idx" ON "inventory"."serial_tracked_items" ("asset_tag");--> statement-breakpoint
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
CREATE INDEX "warehouse_storages_warehouse_id_idx" ON "inventory"."warehouse_storages" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_storages_warehouse_code_uq" ON "inventory"."warehouse_storages" ("warehouse_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_code_uq" ON "inventory"."warehouses" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_code_uq" ON "inventory"."warehouses" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "warehouses_is_default_idx" ON "inventory"."warehouses" ("is_default");--> statement-breakpoint
CREATE INDEX "warehouses_is_active_idx" ON "inventory"."warehouses" ("is_active");--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "inventory"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_line_id_borrowing_lines_id_fkey" FOREIGN KEY ("borrowing_line_id") REFERENCES "inventory"."borrowing_lines"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_lines" ADD CONSTRAINT "borrowing_lines_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "inventory"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_lines" ADD CONSTRAINT "borrowing_lines_DVDSWoOgcOys_fkey" FOREIGN KEY ("serial_tracked_item_id") REFERENCES "inventory"."serial_tracked_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_lines" ADD CONSTRAINT "borrowing_lines_origin_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_bin_id_warehouse_storages_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "inventory"."warehouse_storages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_target_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("target_warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_addresses" ADD CONSTRAINT "warehouse_addresses_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_storages" ADD CONSTRAINT "warehouse_storages_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;