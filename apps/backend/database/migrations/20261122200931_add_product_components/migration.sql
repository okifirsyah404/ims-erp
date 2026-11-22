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
CREATE UNIQUE INDEX "product_components_product_component_uq" ON "product"."product_components" ("product_id","component_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "product_components_component_id_idx" ON "product"."product_components" ("component_id");--> statement-breakpoint
ALTER TABLE "product"."product_components" ADD CONSTRAINT "product_components_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"."products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product"."product_components" ADD CONSTRAINT "product_components_component_id_products_id_fkey" FOREIGN KEY ("component_id") REFERENCES "product"."products"("id") ON DELETE RESTRICT;