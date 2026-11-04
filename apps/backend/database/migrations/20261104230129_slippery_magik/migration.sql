CREATE SCHEMA "assets";
--> statement-breakpoint
CREATE TABLE "assets"."asset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"assigned_to_employee_id" uuid,
	"assigned_to_user_id" text,
	"assigned_at" bigint NOT NULL,
	"returned_at" bigint,
	"condition_on_assign" text,
	"condition_on_return" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_assignments_returned_check" CHECK ("returned_at" IS NULL OR "returned_at" >= "assigned_at")
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"parent_category_id" uuid,
	"asset_type" text DEFAULT 'equipment' NOT NULL,
	"default_useful_life_months" integer,
	"default_depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_categories_asset_type_check" CHECK ("asset_type" IN ('equipment', 'vehicle', 'tool', 'furniture', 'it', 'intangible')),
	CONSTRAINT "asset_categories_dep_method_check" CHECK ("default_depreciation_method" IN ('straight_line', 'declining_balance', 'none'))
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_condition_checks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"check_date" date NOT NULL,
	"condition" text NOT NULL,
	"findings" text,
	"checked_by_user_id" text,
	"next_check_date" date,
	"status" text DEFAULT 'recorded' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_condition_checks_condition_check" CHECK ("condition" IN ('new', 'good', 'fair', 'poor', 'damaged')),
	CONSTRAINT "asset_condition_checks_status_check" CHECK ("status" IN ('recorded', 'followed_up', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_depreciations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"depreciation_amount" bigint DEFAULT 0 NOT NULL,
	"opening_book_value" bigint DEFAULT 0 NOT NULL,
	"closing_book_value" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"calculated_at" bigint,
	"journal_entry_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_depreciations_period_month_check" CHECK ("period_month" BETWEEN 1 AND 12),
	CONSTRAINT "asset_depreciations_method_check" CHECK ("depreciation_method" IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "asset_depreciations_amount_check" CHECK ("depreciation_amount" >= 0),
	CONSTRAINT "asset_depreciations_closing_check" CHECK ("closing_book_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_disposals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"asset_id" uuid NOT NULL,
	"disposal_date" date,
	"disposal_method" text DEFAULT 'scrap' NOT NULL,
	"proceeds_amount" bigint DEFAULT 0 NOT NULL,
	"book_value_at_disposal" bigint DEFAULT 0 NOT NULL,
	"gain_loss" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"buyer_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"requested_by" text,
	"approved_by" text,
	"approved_at" bigint,
	"executed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_disposals_method_check" CHECK ("disposal_method" IN ('sale', 'scrap', 'donation', 'transfer', 'trade_in')),
	CONSTRAINT "asset_disposals_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'executed', 'cancelled')),
	CONSTRAINT "asset_disposals_proceeds_check" CHECK ("proceeds_amount" >= 0),
	CONSTRAINT "asset_disposals_book_value_check" CHECK ("book_value_at_disposal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_documents_type_check" CHECK ("document_type" IN ('invoice', 'manual', 'certificate', 'photo', 'contract'))
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_maintenances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"asset_id" uuid NOT NULL,
	"maintenance_type" text DEFAULT 'preventive' NOT NULL,
	"scheduled_date" date,
	"performed_date" date,
	"performed_by_employee_id" uuid,
	"vendor_name" text,
	"cost" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"description" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"next_service_date" date,
	"document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_maintenances_type_check" CHECK ("maintenance_type" IN ('preventive', 'corrective', 'calibration', 'inspection')),
	CONSTRAINT "asset_maintenances_status_check" CHECK ("status" IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "asset_maintenances_cost_check" CHECK ("cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"movement_type" text DEFAULT 'transfer' NOT NULL,
	"from_location" text,
	"to_location" text,
	"moved_at" bigint NOT NULL,
	"moved_by_user_id" text,
	"condition" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_movements_type_check" CHECK ("movement_type" IN ('transfer', 'loan', 'return', 'project_site'))
);
--> statement-breakpoint
CREATE TABLE "assets"."assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"asset_type" text DEFAULT 'equipment' NOT NULL,
	"serial_number" text,
	"barcode" text,
	"acquisition_date" date,
	"acquisition_cost" bigint DEFAULT 0 NOT NULL,
	"salvage_value" bigint DEFAULT 0 NOT NULL,
	"accumulated_depreciation" bigint DEFAULT 0 NOT NULL,
	"book_value" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"useful_life_months" integer,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"depreciation_started_on" date,
	"condition" text DEFAULT 'good' NOT NULL,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"deactivation_reason" text,
	"location_description" text,
	"custodian_employee_id" uuid,
	"assigned_at" bigint,
	"supplier_id" uuid,
	"purchase_order_id" uuid,
	"document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "assets_asset_type_check" CHECK ("asset_type" IN ('equipment', 'vehicle', 'tool', 'furniture', 'it', 'intangible')),
	CONSTRAINT "assets_status_check" CHECK ("status" IN ('in_stock', 'in_use', 'maintenance', 'inactive', 'disposed', 'lost')),
	CONSTRAINT "assets_condition_check" CHECK ("condition" IN ('new', 'good', 'fair', 'poor', 'damaged')),
	CONSTRAINT "assets_dep_method_check" CHECK ("depreciation_method" IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "assets_acquisition_cost_check" CHECK ("acquisition_cost" >= 0),
	CONSTRAINT "assets_salvage_value_check" CHECK ("salvage_value" >= 0),
	CONSTRAINT "assets_accumulated_depreciation_check" CHECK ("accumulated_depreciation" >= 0),
	CONSTRAINT "assets_book_value_check" CHECK ("book_value" >= 0),
	CONSTRAINT "assets_useful_life_check" CHECK ("useful_life_months" IS NULL OR "useful_life_months" > 0),
	CONSTRAINT "assets_deactivation_reason_check" CHECK (("status" = 'inactive' AND "deactivation_reason" IS NOT NULL) OR ("status" <> 'inactive' AND "deactivation_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "assets"."tool_set_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"tool_set_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "tool_set_items_quantity_check" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."tool_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"custodian_employee_id" uuid,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "tool_sets_status_check" CHECK ("status" IN ('available', 'lent', 'maintenance', 'retired'))
);
--> statement-breakpoint
DROP INDEX "inventory"."warehouses_global_default_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_default_uq" ON "inventory"."warehouses" (coalesce("organization_id", '00000000-0000-0000-0000-000000000000')) WHERE organization_id IS NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "asset_assignments_asset_id_idx" ON "assets"."asset_assignments" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_assignments_employee_id_idx" ON "assets"."asset_assignments" ("assigned_to_employee_id");--> statement-breakpoint
CREATE INDEX "asset_assignments_open_idx" ON "assets"."asset_assignments" ("asset_id") WHERE returned_at IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "asset_categories_org_code_uq" ON "assets"."asset_categories" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "asset_categories_parent_category_id_idx" ON "assets"."asset_categories" ("parent_category_id");--> statement-breakpoint
CREATE INDEX "asset_condition_checks_asset_id_idx" ON "assets"."asset_condition_checks" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_condition_checks_check_date_idx" ON "assets"."asset_condition_checks" ("check_date");--> statement-breakpoint
CREATE INDEX "asset_depreciations_period_uq" ON "assets"."asset_depreciations" ("asset_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "asset_depreciations_period_year_idx" ON "assets"."asset_depreciations" ("period_year");--> statement-breakpoint
CREATE INDEX "asset_disposals_org_code_uq" ON "assets"."asset_disposals" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "asset_disposals_asset_id_idx" ON "assets"."asset_disposals" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_disposals_status_idx" ON "assets"."asset_disposals" ("status");--> statement-breakpoint
CREATE INDEX "asset_documents_asset_id_idx" ON "assets"."asset_documents" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_documents_document_id_uq" ON "assets"."asset_documents" ("document_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "asset_maintenances_org_code_uq" ON "assets"."asset_maintenances" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "asset_maintenances_asset_id_idx" ON "assets"."asset_maintenances" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_maintenances_status_idx" ON "assets"."asset_maintenances" ("status");--> statement-breakpoint
CREATE INDEX "asset_maintenances_next_service_date_idx" ON "assets"."asset_maintenances" ("next_service_date");--> statement-breakpoint
CREATE INDEX "asset_movements_asset_id_idx" ON "assets"."asset_movements" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_movements_moved_at_idx" ON "assets"."asset_movements" ("moved_at");--> statement-breakpoint
CREATE INDEX "assets_org_code_uq" ON "assets"."assets" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "assets_category_id_idx" ON "assets"."assets" ("category_id");--> statement-breakpoint
CREATE INDEX "assets_custodian_employee_id_idx" ON "assets"."assets" ("custodian_employee_id");--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets"."assets" ("status");--> statement-breakpoint
CREATE INDEX "assets_serial_number_idx" ON "assets"."assets" ("serial_number");--> statement-breakpoint
CREATE INDEX "tool_set_items_tool_set_id_idx" ON "assets"."tool_set_items" ("tool_set_id");--> statement-breakpoint
CREATE INDEX "tool_set_items_asset_id_idx" ON "assets"."tool_set_items" ("asset_id");--> statement-breakpoint
CREATE INDEX "tool_set_items_uq" ON "assets"."tool_set_items" ("tool_set_id","asset_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tool_sets_org_code_uq" ON "assets"."tool_sets" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tool_sets_custodian_employee_id_idx" ON "assets"."tool_sets" ("custodian_employee_id");--> statement-breakpoint
ALTER TABLE "assets"."asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."asset_condition_checks" ADD CONSTRAINT "asset_condition_checks_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."asset_depreciations" ADD CONSTRAINT "asset_depreciations_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."asset_disposals" ADD CONSTRAINT "asset_disposals_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assets"."asset_documents" ADD CONSTRAINT "asset_documents_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."asset_maintenances" ADD CONSTRAINT "asset_maintenances_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ADD CONSTRAINT "asset_movements_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."tool_set_items" ADD CONSTRAINT "tool_set_items_tool_set_id_tool_sets_id_fkey" FOREIGN KEY ("tool_set_id") REFERENCES "assets"."tool_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."tool_set_items" ADD CONSTRAINT "tool_set_items_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE RESTRICT;