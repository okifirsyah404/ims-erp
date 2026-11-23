CREATE SCHEMA "product";
--> statement-breakpoint
CREATE TABLE "product"."product_categories" (
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
CREATE TABLE "product"."code_numberings" (
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
	CONSTRAINT "product_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "product_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "product"."product_components" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"product_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"quantity" numeric(18,3) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "product_components_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "product_components_distinct_check" CHECK (product_id <> component_id)
);
--> statement-breakpoint
CREATE TABLE "product"."product_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"product_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"caption" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "product"."settings" (
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
	CONSTRAINT "product_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "product"."products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"serial_number" text,
	"name" text NOT NULL,
	"description" text,
	"product_kind" text NOT NULL,
	"product_category_id" uuid,
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
	"slug" varchar(120),
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" bigint,
	"listing_specs" varchar(400),
	"price_mode" text DEFAULT 'list' NOT NULL,
	"price_caption" varchar(120),
	"out_of_stock_mode" text DEFAULT 'request' NOT NULL,
	"lead_time_label" varchar(60),
	"applications" jsonb DEFAULT '[]' NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "products_kind_check" CHECK (product_kind IN ('product', 'component', 'material')),
	CONSTRAINT "products_prices_check" CHECK (selling_price >= 0 AND purchase_price >= 0),
	CONSTRAINT "products_min_stock_check" CHECK (min_stock_qty >= 0),
	CONSTRAINT "products_unit_label_check" CHECK (unit_label IN ('pcs', 'unit', 'set', 'paket', 'titik', 'm', 'roll', 'kg', 'jam', 'bulan', 'tahun', 'lic', 'lot', 'pulau')),
	CONSTRAINT "products_price_mode_check" CHECK (price_mode IN ('list', 'rfq')),
	CONSTRAINT "products_out_of_stock_mode_check" CHECK (out_of_stock_mode IN ('out', 'preorder', 'request')),
	CONSTRAINT "products_popularity_check" CHECK (popularity >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_uq" ON "product"."product_categories" ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_code_numberings_type_uq" ON "product"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_components_product_component_uq" ON "product"."product_components" ("product_id","component_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "product_components_component_id_idx" ON "product"."product_components" ("component_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_sort_idx" ON "product"."product_images" ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_settings_scope_uq" ON "product"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_code_uq" ON "product"."products" ("organization_id","code") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_global_code_uq" ON "product"."products" ("code") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_sku_uq" ON "product"."products" ("organization_id","sku") WHERE organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_global_sku_uq" ON "product"."products" ("sku") WHERE organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uq" ON "product"."products" ("slug") WHERE deleted_at IS NULL AND slug IS NOT NULL;--> statement-breakpoint
CREATE INDEX "products_kind_idx" ON "product"."products" ("product_kind");--> statement-breakpoint
CREATE INDEX "products_org_name_idx" ON "product"."products" ("organization_id","name");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "product"."products" ("barcode");--> statement-breakpoint
ALTER TABLE "product"."product_components" ADD CONSTRAINT "product_components_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"."products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product"."product_components" ADD CONSTRAINT "product_components_component_id_products_id_fkey" FOREIGN KEY ("component_id") REFERENCES "product"."products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product"."product_images" ADD CONSTRAINT "product_images_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"."products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product"."products" ADD CONSTRAINT "products_product_category_id_product_categories_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "product"."product_categories"("id") ON DELETE RESTRICT;