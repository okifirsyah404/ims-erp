CREATE TABLE "assets"."asset_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"default_useful_life_months" integer,
	"default_depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "asset_types_dep_method_check" CHECK (default_depreciation_method IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "asset_types_useful_life_check" CHECK (default_useful_life_months IS NULL OR default_useful_life_months > 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."borrowing_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_id" uuid NOT NULL,
	"borrowing_line_id" uuid,
	"event_type" text NOT NULL,
	"asset_movement_id" uuid,
	"actor_user_id" text,
	"occurred_at" bigint NOT NULL,
	"note" text,
	CONSTRAINT "borrowing_events_type_check" CHECK (event_type IN ('requested', 'approved', 'rejected', 'issued', 'returned', 'marked_late', 'marked_lost', 'due_date_extended', 'cancelled', 'closed')),
	CONSTRAINT "borrowing_events_movement_check" CHECK ((event_type IN ('issued', 'returned', 'marked_lost') AND asset_movement_id IS NOT NULL)
				OR (event_type NOT IN ('issued', 'returned', 'marked_lost') AND asset_movement_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "assets"."borrowing_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"origin_warehouse_id" uuid,
	"origin_storage_id" uuid,
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
	CONSTRAINT "borrowing_lines_due_after_issue_check" CHECK (due_at IS NULL OR issued_at IS NULL OR due_at > issued_at),
	CONSTRAINT "borrowing_lines_origin_storage_check" CHECK (origin_storage_id IS NULL OR origin_warehouse_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "assets"."borrowings" (
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
ALTER TABLE "assets"."assets" RENAME COLUMN "assigned_at" TO "borrowed_since";--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP CONSTRAINT "assets_asset_type_check";--> statement-breakpoint
ALTER TABLE "inventory"."items" DROP CONSTRAINT "inventory_items_service_not_stocked_check";--> statement-breakpoint
ALTER TABLE "assets"."asset_categories" DROP CONSTRAINT "asset_categories_asset_type_check";--> statement-breakpoint
DROP INDEX "assets"."assets_org_code_uq";--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ADD COLUMN "from_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ADD COLUMN "from_storage_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ADD COLUMN "to_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ADD COLUMN "to_storage_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD COLUMN "storage_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset_assignments" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_categories" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_condition_checks" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_depreciations" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_disposals" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_documents" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_maintenances" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."assets" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."assets" ALTER COLUMN "status" SET DEFAULT 'ready';--> statement-breakpoint
ALTER TABLE "assets"."tool_set_items" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."tool_sets" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "assets"."asset_categories_org_code_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "asset_categories_org_code_uq" ON "assets"."asset_categories" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
DROP INDEX "assets"."asset_disposals_org_code_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "asset_disposals_org_code_uq" ON "assets"."asset_disposals" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
DROP INDEX "assets"."asset_maintenances_org_code_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "asset_maintenances_org_code_uq" ON "assets"."asset_maintenances" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
DROP INDEX "assets"."tool_sets_org_code_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sets_org_code_uq" ON "assets"."tool_sets" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_categories_global_code_uq" ON "assets"."asset_categories" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_disposals_global_code_uq" ON "assets"."asset_disposals" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_maintenances_global_code_uq" ON "assets"."asset_maintenances" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "asset_movements_movement_type_idx" ON "assets"."asset_movements" ("movement_type");--> statement-breakpoint
CREATE INDEX "asset_movements_from_warehouse_id_idx" ON "assets"."asset_movements" ("from_warehouse_id");--> statement-breakpoint
CREATE INDEX "asset_movements_to_warehouse_id_idx" ON "assets"."asset_movements" ("to_warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_types_code_uq" ON "assets"."asset_types" ("code");--> statement-breakpoint
CREATE INDEX "asset_types_is_active_idx" ON "assets"."asset_types" ("is_active");--> statement-breakpoint
INSERT INTO "assets"."asset_types" ("code", "name", "created_at") VALUES
	('equipment', 'Equipment', 1),
	('vehicle', 'Vehicle', 1),
	('tool', 'Tool', 1),
	('furniture', 'Furniture', 1),
	('it', 'IT', 1),
	('intangible', 'Intangible', 1)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_code_uq" ON "assets"."assets" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_serial_uq" ON "assets"."assets" (coalesce("organization_id", ''),"serial_number") WHERE "serial_number" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "assets_asset_type_idx" ON "assets"."assets" ("asset_type");--> statement-breakpoint
CREATE INDEX "assets_warehouse_id_idx" ON "assets"."assets" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "assets_storage_id_idx" ON "assets"."assets" ("storage_id");--> statement-breakpoint
CREATE INDEX "borrowing_events_borrowing_occurred_idx" ON "assets"."borrowing_events" ("borrowing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "borrowing_events_line_id_idx" ON "assets"."borrowing_events" ("borrowing_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_lines_borrowing_asset_uq" ON "assets"."borrowing_lines" ("borrowing_id","asset_id");--> statement-breakpoint
CREATE INDEX "borrowing_lines_asset_id_idx" ON "assets"."borrowing_lines" ("asset_id");--> statement-breakpoint
CREATE INDEX "borrowing_lines_open_idx" ON "assets"."borrowing_lines" ("due_at") WHERE returned_at IS NULL AND marked_lost_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_org_code_uq" ON "assets"."borrowings" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_global_code_uq" ON "assets"."borrowings" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "borrowings_status_idx" ON "assets"."borrowings" ("status");--> statement-breakpoint
CREATE INDEX "borrowings_borrower_user_id_idx" ON "assets"."borrowings" ("borrower_user_id");--> statement-breakpoint
CREATE INDEX "borrowings_borrower_customer_id_idx" ON "assets"."borrowings" ("borrower_customer_id");--> statement-breakpoint
CREATE INDEX "borrowings_due_at_idx" ON "assets"."borrowings" ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sets_global_code_uq" ON "assets"."tool_sets" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_categories" ADD CONSTRAINT "asset_categories_asset_type_asset_types_code_fkey" FOREIGN KEY ("asset_type") REFERENCES "assets"."asset_types"("code") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD CONSTRAINT "assets_asset_type_asset_types_code_fkey" FOREIGN KEY ("asset_type") REFERENCES "assets"."asset_types"("code") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assets"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "assets"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_line_id_borrowing_lines_id_fkey" FOREIGN KEY ("borrowing_line_id") REFERENCES "assets"."borrowing_lines"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."borrowing_lines" ADD CONSTRAINT "borrowing_lines_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "assets"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets"."borrowing_lines" ADD CONSTRAINT "borrowing_lines_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD CONSTRAINT "assets_storage_requires_warehouse_check" CHECK ("storage_id" IS NULL OR "warehouse_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "assets"."assets" DROP CONSTRAINT "assets_status_check";--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" DROP CONSTRAINT "asset_movements_type_check";--> statement-breakpoint
UPDATE "assets"."assets" SET "status" = 'ready' WHERE "status" = 'in_stock';--> statement-breakpoint
UPDATE "assets"."assets" SET "status" = 'borrowed' WHERE "status" = 'in_use';--> statement-breakpoint
UPDATE "assets"."asset_movements" SET "movement_type" = 'borrow_out' WHERE "movement_type" = 'loan';--> statement-breakpoint
UPDATE "assets"."asset_movements" SET "movement_type" = 'borrow_return' WHERE "movement_type" = 'return';--> statement-breakpoint
ALTER TABLE "inventory"."items" DROP CONSTRAINT "inventory_items_kind_check", ADD CONSTRAINT "inventory_items_kind_check" CHECK (item_kind IN ('product', 'component', 'material'));--> statement-breakpoint
ALTER TABLE "assets"."asset_movements" ADD CONSTRAINT "asset_movements_type_check" CHECK ("movement_type" IN ('receipt', 'transfer', 'borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost'));--> statement-breakpoint
ALTER TABLE "assets"."assets" ADD CONSTRAINT "assets_status_check" CHECK ("status" IN ('ready', 'borrowed', 'maintenance', 'inactive', 'disposed', 'lost'));