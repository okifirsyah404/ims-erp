CREATE TABLE "inventory"."item_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"item_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"caption" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
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
CREATE TABLE "warehouse"."warehouse_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"caption" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE INDEX "item_images_item_id_sort_idx" ON "inventory"."item_images" ("item_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_images_product_id_sort_idx" ON "product"."product_images" ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "warehouse_images_warehouse_id_sort_idx" ON "warehouse"."warehouse_images" ("warehouse_id","sort_order");--> statement-breakpoint
ALTER TABLE "inventory"."item_images" ADD CONSTRAINT "item_images_item_id_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product"."product_images" ADD CONSTRAINT "product_images_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"."products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "warehouse"."warehouse_images" ADD CONSTRAINT "warehouse_images_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Backfill: each existing single photo becomes the first (cover) gallery image.
INSERT INTO "product"."product_images" ("product_id", "object_key", "sort_order", "created_at")
SELECT "id", "image_object_key", 0, (extract(epoch FROM now()) * 1000)::bigint
FROM "product"."products" WHERE "image_object_key" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
INSERT INTO "inventory"."item_images" ("item_id", "object_key", "sort_order", "created_at")
SELECT "id", "image_object_key", 0, (extract(epoch FROM now()) * 1000)::bigint
FROM "inventory"."items" WHERE "image_object_key" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
INSERT INTO "warehouse"."warehouse_images" ("warehouse_id", "object_key", "sort_order", "created_at")
SELECT "id", "image_object_key", 0, (extract(epoch FROM now()) * 1000)::bigint
FROM "warehouse"."warehouses" WHERE "image_object_key" IS NOT NULL AND "deleted_at" IS NULL;
