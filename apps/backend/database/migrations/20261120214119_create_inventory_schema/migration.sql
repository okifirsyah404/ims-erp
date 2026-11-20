CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_id" uuid NOT NULL,
	"borrowing_item_id" uuid,
	"event_type" text NOT NULL,
	"movement_id" uuid,
	"actor_user_id" text,
	"occurred_at" bigint NOT NULL,
	"note" text,
	CONSTRAINT "borrowing_events_type_check" CHECK (event_type IN ('issued', 'returned', 'marked_late', 'marked_lost', 'due_date_extended', 'closed')),
	CONSTRAINT "borrowing_events_movement_check" CHECK ((event_type IN ('issued', 'returned', 'marked_lost') AND movement_id IS NOT NULL)
				OR (event_type NOT IN ('issued', 'returned', 'marked_lost') AND movement_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"borrowing_request_id" uuid NOT NULL,
	"borrowing_id" uuid,
	"item_id" uuid NOT NULL,
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
	CONSTRAINT "borrowing_items_condition_check" CHECK (returned_condition IS NULL OR returned_condition IN ('good', 'damaged', 'incomplete')),
	CONSTRAINT "borrowing_items_due_after_issue_check" CHECK (due_at IS NULL OR issued_at IS NULL OR due_at > issued_at),
	CONSTRAINT "borrowing_items_origin_storage_check" CHECK (origin_storage_id IS NULL OR origin_warehouse_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_request_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"borrowing_request_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" text,
	"occurred_at" bigint NOT NULL,
	"note" text,
	CONSTRAINT "borrowing_request_events_type_check" CHECK (event_type IN ('requested', 'approved', 'rejected', 'cancelled', 'due_date_extended'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowing_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"purpose" text DEFAULT 'internal_use' NOT NULL,
	"borrower_type" text NOT NULL,
	"tool_set_id" uuid,
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
	"due_at" bigint NOT NULL,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowing_requests_status_check" CHECK (status IN ('draft', 'requested', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "borrowing_requests_purpose_check" CHECK (purpose IN ('rental', 'internal_use', 'testing', 'warranty_service')),
	CONSTRAINT "borrowing_requests_borrower_type_check" CHECK (borrower_type IN ('user', 'customer', 'guest')),
	CONSTRAINT "borrowing_requests_guest_id_type_check" CHECK (guest_id_type IS NULL OR guest_id_type IN ('ktp', 'sim', 'passport', 'other')),
	CONSTRAINT "borrowing_requests_borrower_identity_check" CHECK ((borrower_type = 'user' AND borrower_user_id IS NOT NULL AND borrower_customer_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'customer' AND borrower_customer_id IS NOT NULL AND borrower_user_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'guest' AND guest_name IS NOT NULL AND guest_phone IS NOT NULL AND guest_id_number IS NOT NULL AND borrower_user_id IS NULL AND borrower_customer_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "inventory"."borrowings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"borrowing_request_id" uuid NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"issued_by" text,
	"issued_at" bigint,
	"due_at" bigint NOT NULL,
	"closed_by" text,
	"closed_at" bigint,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "borrowings_status_check" CHECK (status IN ('issued', 'partially_returned', 'returned', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."condition_checks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid NOT NULL,
	"check_date" date NOT NULL,
	"condition" text NOT NULL,
	"findings" text,
	"checked_by_user_id" text,
	"next_check_date" date,
	"status" text DEFAULT 'recorded' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "condition_checks_condition_check" CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
	CONSTRAINT "condition_checks_status_check" CHECK (status IN ('recorded', 'followed_up', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."disposals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"item_id" uuid NOT NULL,
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
	CONSTRAINT "disposals_method_check" CHECK (disposal_method IN ('sale', 'scrap', 'donation', 'transfer', 'trade_in')),
	CONSTRAINT "disposals_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'executed', 'cancelled')),
	CONSTRAINT "disposals_proceeds_check" CHECK (proceeds_amount >= 0),
	CONSTRAINT "disposals_book_value_check" CHECK (book_value_at_disposal >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."code_numberings" (
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
	CONSTRAINT "inventory_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "inventory_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"product_id" uuid,
	"item_id" uuid,
	"document_type" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "inventory_documents_type_check" CHECK (document_type IN ('photo', 'manual', 'datasheet', 'certificate', 'invoice', 'contract')),
	CONSTRAINT "inventory_documents_owner_check" CHECK ((product_id IS NOT NULL AND item_id IS NULL) OR (product_id IS NULL AND item_id IS NOT NULL)),
	CONSTRAINT "inventory_documents_size_check" CHECK (size_bytes >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "inventory_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."item_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"parent_category_id" uuid,
	"item_kind" text DEFAULT 'equipment' NOT NULL,
	"default_useful_life_months" integer,
	"default_depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "item_categories_dep_method_check" CHECK (default_depreciation_method IN ('straight_line', 'declining_balance', 'none'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."item_serials" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"product_id" uuid,
	"serial_number" text NOT NULL,
	"is_provisional_serial" boolean DEFAULT false NOT NULL,
	"asset_tag" text,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"acquired_on" date,
	"warranty_expires_on" date,
	"purchase_order_line_id" uuid,
	"customer_id" uuid,
	"company_id" uuid,
	"movement_id" uuid,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "item_serials_status_check" CHECK (status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged')),
	CONSTRAINT "item_serials_provisional_check" CHECK (is_provisional_serial = false OR status = 'pre_order'),
	CONSTRAINT "item_serials_warranty_check" CHECK (warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on)
);
--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"item_kind" text DEFAULT 'equipment' NOT NULL,
	"item_category_id" uuid,
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
	"status" text DEFAULT 'ready' NOT NULL,
	"deactivation_reason" text,
	"location_description" text,
	"warehouse_id" uuid,
	"storage_id" uuid,
	"custodian_employee_id" uuid,
	"borrowed_since" bigint,
	"supplier_company_id" uuid,
	"purchase_order_id" uuid,
	"document_id" uuid,
	"image_url" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "items_status_check" CHECK (status IN ('ready', 'borrowed', 'maintenance', 'inactive', 'disposed', 'lost')),
	CONSTRAINT "items_condition_check" CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
	CONSTRAINT "items_dep_method_check" CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
	CONSTRAINT "items_acquisition_cost_check" CHECK (acquisition_cost >= 0),
	CONSTRAINT "items_salvage_value_check" CHECK (salvage_value >= 0),
	CONSTRAINT "items_accumulated_depreciation_check" CHECK (accumulated_depreciation >= 0),
	CONSTRAINT "items_book_value_check" CHECK (book_value >= 0),
	CONSTRAINT "items_useful_life_check" CHECK (useful_life_months IS NULL OR useful_life_months > 0),
	CONSTRAINT "items_deactivation_reason_check" CHECK ((status = 'inactive' AND deactivation_reason IS NOT NULL) OR (status <> 'inactive' AND deactivation_reason IS NULL)),
	CONSTRAINT "items_storage_requires_warehouse_check" CHECK (storage_id IS NULL OR warehouse_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "inventory"."maintenances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"item_id" uuid NOT NULL,
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
	CONSTRAINT "maintenances_type_check" CHECK (maintenance_type IN ('preventive', 'corrective', 'calibration', 'inspection')),
	CONSTRAINT "maintenances_status_check" CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "maintenances_cost_check" CHECK (cost >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"movement_type" text NOT NULL,
	"product_id" uuid,
	"item_id" uuid,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"target_warehouse_id" uuid,
	"target_bin_id" uuid,
	"from_location" text,
	"to_location" text,
	"quantity" numeric(18,3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"occurred_at" bigint NOT NULL,
	"created_by" text,
	"notes" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "movements_type_check" CHECK (movement_type IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'consumption', 'borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost')),
	CONSTRAINT "movements_status_check" CHECK (status IN ('draft', 'posted', 'reversed')),
	CONSTRAINT "movements_quantity_check" CHECK (quantity <> 0),
	CONSTRAINT "movements_owner_check" CHECK ((product_id IS NOT NULL AND item_id IS NULL) OR (product_id IS NULL AND item_id IS NOT NULL)),
	CONSTRAINT "movements_transfer_target_check" CHECK ((movement_type IN ('transfer_in', 'transfer_out') AND target_warehouse_id IS NOT NULL) OR (movement_type NOT IN ('transfer_in', 'transfer_out'))),
	CONSTRAINT "movements_item_type_check" CHECK ((movement_type IN ('borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost') AND item_id IS NOT NULL) OR (movement_type NOT IN ('borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost')))
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_adjustment_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"stock_adjustment_id" uuid NOT NULL,
	"product_id" uuid,
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
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"warehouse_id" uuid,
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
CREATE TABLE "inventory"."stocks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"product_id" uuid,
	"warehouse_id" uuid,
	"bin_id" uuid,
	"quantity_on_hand" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_reserved" numeric(18,3) DEFAULT '0' NOT NULL,
	"quantity_available" numeric(18,3) DEFAULT '0' NOT NULL,
	"average_cost" bigint DEFAULT 0 NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"last_movement_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "stocks_available_check" CHECK (quantity_available = quantity_on_hand - quantity_reserved),
	CONSTRAINT "stocks_on_hand_check" CHECK (quantity_on_hand >= 0),
	CONSTRAINT "stocks_reserved_check" CHECK (quantity_reserved >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."tool_set_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tool_set_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "tool_set_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."tool_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"custodian_employee_id" uuid,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "tool_sets_status_check" CHECK (status IN ('available', 'lent', 'maintenance', 'retired'))
);
--> statement-breakpoint
CREATE INDEX "borrowing_events_borrowing_occurred_idx" ON "inventory"."borrowing_events" ("borrowing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "borrowing_events_item_id_idx" ON "inventory"."borrowing_events" ("borrowing_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_items_request_item_uq" ON "inventory"."borrowing_items" ("borrowing_request_id","item_id");--> statement-breakpoint
CREATE INDEX "borrowing_items_borrowing_id_idx" ON "inventory"."borrowing_items" ("borrowing_id");--> statement-breakpoint
CREATE INDEX "borrowing_items_item_id_idx" ON "inventory"."borrowing_items" ("item_id");--> statement-breakpoint
CREATE INDEX "borrowing_items_open_idx" ON "inventory"."borrowing_items" ("due_at") WHERE returned_at IS NULL AND marked_lost_at IS NULL;--> statement-breakpoint
CREATE INDEX "borrowing_request_events_request_occurred_idx" ON "inventory"."borrowing_request_events" ("borrowing_request_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_requests_org_code_uq" ON "inventory"."borrowing_requests" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_requests_global_code_uq" ON "inventory"."borrowing_requests" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "borrowing_requests_status_idx" ON "inventory"."borrowing_requests" ("status");--> statement-breakpoint
CREATE INDEX "borrowing_requests_borrower_user_id_idx" ON "inventory"."borrowing_requests" ("borrower_user_id");--> statement-breakpoint
CREATE INDEX "borrowing_requests_borrower_customer_id_idx" ON "inventory"."borrowing_requests" ("borrower_customer_id");--> statement-breakpoint
CREATE INDEX "borrowing_requests_due_at_idx" ON "inventory"."borrowing_requests" ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_org_code_uq" ON "inventory"."borrowings" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_global_code_uq" ON "inventory"."borrowings" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowings_request_uq" ON "inventory"."borrowings" ("borrowing_request_id");--> statement-breakpoint
CREATE INDEX "borrowings_status_idx" ON "inventory"."borrowings" ("status");--> statement-breakpoint
CREATE INDEX "borrowings_due_at_idx" ON "inventory"."borrowings" ("due_at");--> statement-breakpoint
CREATE INDEX "condition_checks_item_id_idx" ON "inventory"."condition_checks" ("item_id");--> statement-breakpoint
CREATE INDEX "condition_checks_check_date_idx" ON "inventory"."condition_checks" ("check_date");--> statement-breakpoint
CREATE UNIQUE INDEX "disposals_org_code_uq" ON "inventory"."disposals" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "disposals_global_code_uq" ON "inventory"."disposals" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "disposals_item_id_idx" ON "inventory"."disposals" ("item_id");--> statement-breakpoint
CREATE INDEX "disposals_status_idx" ON "inventory"."disposals" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_code_numberings_type_uq" ON "inventory"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_documents_product_id_idx" ON "inventory"."documents" ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_documents_item_id_idx" ON "inventory"."documents" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_settings_scope_uq" ON "inventory"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_categories_org_code_uq" ON "inventory"."item_categories" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_categories_global_code_uq" ON "inventory"."item_categories" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "item_categories_parent_category_id_idx" ON "inventory"."item_categories" ("parent_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_serials_org_serial_uq" ON "inventory"."item_serials" ("organization_id","serial_number") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_serials_global_serial_uq" ON "inventory"."item_serials" ("serial_number") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "item_serials_product_id_idx" ON "inventory"."item_serials" ("product_id");--> statement-breakpoint
CREATE INDEX "item_serials_status_idx" ON "inventory"."item_serials" ("status");--> statement-breakpoint
CREATE INDEX "item_serials_warehouse_id_idx" ON "inventory"."item_serials" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_code_uq" ON "inventory"."items" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "items_serial_uq" ON "inventory"."items" (coalesce("organization_id", ''),"serial_number") WHERE "serial_number" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "items_item_kind_idx" ON "inventory"."items" ("item_kind");--> statement-breakpoint
CREATE INDEX "items_item_category_id_idx" ON "inventory"."items" ("item_category_id");--> statement-breakpoint
CREATE INDEX "items_custodian_employee_id_idx" ON "inventory"."items" ("custodian_employee_id");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "inventory"."items" ("status");--> statement-breakpoint
CREATE INDEX "items_warehouse_id_idx" ON "inventory"."items" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "items_storage_id_idx" ON "inventory"."items" ("storage_id");--> statement-breakpoint
CREATE INDEX "items_serial_number_idx" ON "inventory"."items" ("serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenances_org_code_uq" ON "inventory"."maintenances" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenances_global_code_uq" ON "inventory"."maintenances" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "maintenances_item_id_idx" ON "inventory"."maintenances" ("item_id");--> statement-breakpoint
CREATE INDEX "maintenances_status_idx" ON "inventory"."maintenances" ("status");--> statement-breakpoint
CREATE INDEX "maintenances_next_service_date_idx" ON "inventory"."maintenances" ("next_service_date");--> statement-breakpoint
CREATE UNIQUE INDEX "movements_org_code_uq" ON "inventory"."movements" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "movements_global_code_uq" ON "inventory"."movements" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "movements_product_ledger_idx" ON "inventory"."movements" ("organization_id","product_id","warehouse_id","occurred_at");--> statement-breakpoint
CREATE INDEX "movements_item_ledger_idx" ON "inventory"."movements" ("organization_id","item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "movements_bin_id_idx" ON "inventory"."movements" ("bin_id");--> statement-breakpoint
CREATE INDEX "movements_reference_type_idx" ON "inventory"."movements" ("reference_type");--> statement-breakpoint
CREATE INDEX "movements_reference_id_idx" ON "inventory"."movements" ("reference_id");--> statement-breakpoint
CREATE INDEX "stock_adjustment_items_adjustment_id_idx" ON "inventory"."stock_adjustment_items" ("stock_adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_org_code_uq" ON "inventory"."stock_adjustments" ("organization_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "stock_adjustments_warehouse_id_idx" ON "inventory"."stock_adjustments" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_status_idx" ON "inventory"."stock_adjustments" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_org_scope_uq" ON "inventory"."stocks" ("organization_id","warehouse_id","product_id","bin_id") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_global_scope_uq" ON "inventory"."stocks" ("warehouse_id","product_id","bin_id") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "stocks_product_id_idx" ON "inventory"."stocks" ("product_id");--> statement-breakpoint
CREATE INDEX "tool_set_items_tool_set_id_idx" ON "inventory"."tool_set_items" ("tool_set_id");--> statement-breakpoint
CREATE INDEX "tool_set_items_item_id_idx" ON "inventory"."tool_set_items" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_set_items_uq" ON "inventory"."tool_set_items" ("tool_set_id","item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sets_org_code_uq" ON "inventory"."tool_sets" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sets_global_code_uq" ON "inventory"."tool_sets" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "tool_sets_custodian_employee_id_idx" ON "inventory"."tool_sets" ("custodian_employee_id");--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "inventory"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" ADD CONSTRAINT "borrowing_events_borrowing_item_id_borrowing_items_id_fkey" FOREIGN KEY ("borrowing_item_id") REFERENCES "inventory"."borrowing_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_items" ADD CONSTRAINT "borrowing_items_borrowing_request_id_borrowing_requests_id_fkey" FOREIGN KEY ("borrowing_request_id") REFERENCES "inventory"."borrowing_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_items" ADD CONSTRAINT "borrowing_items_borrowing_id_borrowings_id_fkey" FOREIGN KEY ("borrowing_id") REFERENCES "inventory"."borrowings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_items" ADD CONSTRAINT "borrowing_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_request_events" ADD CONSTRAINT "borrowing_request_events_NBRRT8st1uwC_fkey" FOREIGN KEY ("borrowing_request_id") REFERENCES "inventory"."borrowing_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."borrowings" ADD CONSTRAINT "borrowings_borrowing_request_id_borrowing_requests_id_fkey" FOREIGN KEY ("borrowing_request_id") REFERENCES "inventory"."borrowing_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."condition_checks" ADD CONSTRAINT "condition_checks_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."disposals" ADD CONSTRAINT "disposals_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_item_category_id_item_categories_id_fkey" FOREIGN KEY ("item_category_id") REFERENCES "inventory"."item_categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "inventory"."maintenances" ADD CONSTRAINT "maintenances_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."movements" ADD CONSTRAINT "movements_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_Gis6x14AGR5M_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "inventory"."stock_adjustments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."tool_set_items" ADD CONSTRAINT "tool_set_items_tool_set_id_tool_sets_id_fkey" FOREIGN KEY ("tool_set_id") REFERENCES "inventory"."tool_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory"."tool_set_items" ADD CONSTRAINT "tool_set_items_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT;