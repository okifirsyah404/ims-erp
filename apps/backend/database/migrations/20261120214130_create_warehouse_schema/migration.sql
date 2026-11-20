CREATE SCHEMA "warehouse";
--> statement-breakpoint
CREATE TABLE "warehouse"."warehouse_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"label" text,
	"address_line" text NOT NULL,
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
CREATE TABLE "warehouse"."code_numberings" (
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
	CONSTRAINT "warehouse_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "warehouse_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "warehouse"."warehouse_managers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"user_id" text,
	"assigned_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "warehouse"."settings" (
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
	CONSTRAINT "warehouse_module_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "warehouse"."warehouse_organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"organization_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "warehouse"."warehouse_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "warehouse_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "warehouse"."warehouse_storages" (
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
CREATE TABLE "warehouse"."warehouses" (
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
CREATE UNIQUE INDEX "warehouse_addresses_warehouse_uq" ON "warehouse"."warehouse_addresses" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_addresses_village_id_idx" ON "warehouse"."warehouse_addresses" ("village_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_code_numberings_type_uq" ON "warehouse"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_managers_uq" ON "warehouse"."warehouse_managers" ("warehouse_id","user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_managers_user_id_idx" ON "warehouse"."warehouse_managers" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_settings_scope_uq" ON "warehouse"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_organizations_warehouse_id_idx" ON "warehouse"."warehouse_organizations" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_organizations_organization_id_idx" ON "warehouse"."warehouse_organizations" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_organizations_uq" ON "warehouse"."warehouse_organizations" ("warehouse_id","organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_settings_uq" ON "warehouse"."warehouse_settings" ("warehouse_id","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "warehouse_storages_warehouse_id_idx" ON "warehouse"."warehouse_storages" ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_storages_warehouse_code_uq" ON "warehouse"."warehouse_storages" ("warehouse_id","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_code_uq" ON "warehouse"."warehouses" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_code_uq" ON "warehouse"."warehouses" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "warehouses_is_default_idx" ON "warehouse"."warehouses" ("is_default");--> statement-breakpoint
CREATE INDEX "warehouses_is_active_idx" ON "warehouse"."warehouses" ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_default_uq" ON "warehouse"."warehouses" ("organization_id") WHERE organization_id IS NOT NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_global_default_uq" ON "warehouse"."warehouses" (coalesce("organization_id", '00000000-0000-0000-0000-000000000000')) WHERE organization_id IS NULL AND is_default AND deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "warehouse"."warehouse_addresses" ADD CONSTRAINT "warehouse_addresses_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warehouse"."warehouse_managers" ADD CONSTRAINT "warehouse_managers_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warehouse"."warehouse_organizations" ADD CONSTRAINT "warehouse_organizations_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warehouse"."warehouse_settings" ADD CONSTRAINT "warehouse_settings_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warehouse"."warehouse_storages" ADD CONSTRAINT "warehouse_storages_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"."warehouses"("id") ON DELETE CASCADE;