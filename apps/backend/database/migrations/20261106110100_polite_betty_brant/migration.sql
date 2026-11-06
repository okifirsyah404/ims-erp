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
ALTER TABLE "inventory"."items" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "brand" varchar(100);--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "specification" text;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "inventory"."items" DROP COLUMN "category";--> statement-breakpoint
-- Backfill (ADR-0011): free-text units outside the fixed list, or empty, become 'pcs' before NOT NULL and the CHECK apply.
UPDATE "inventory"."items" SET "unit_label" = 'pcs' WHERE "unit_label" IS NULL OR "unit_label" NOT IN ('pcs', 'unit', 'set', 'paket', 'titik', 'm', 'roll', 'kg', 'jam', 'bulan', 'tahun', 'lic', 'lot', 'pulau');--> statement-breakpoint
ALTER TABLE "inventory"."items" ALTER COLUMN "unit_label" SET DEFAULT 'pcs';--> statement-breakpoint
ALTER TABLE "inventory"."items" ALTER COLUMN "unit_label" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_categories_slug_uq" ON "inventory"."item_categories" ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_items_category_id_idx" ON "inventory"."items" ("category_id");--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_category_id_item_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory"."item_categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "inventory_items_unit_label_check" CHECK (unit_label IN ('pcs', 'unit', 'set', 'paket', 'titik', 'm', 'roll', 'kg', 'jam', 'bulan', 'tahun', 'lic', 'lot', 'pulau'));