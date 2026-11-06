CREATE TABLE "inventory"."warehouse_organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE INDEX "warehouse_organizations_warehouse_id_idx" ON "inventory"."warehouse_organizations" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_organizations_organization_id_idx" ON "inventory"."warehouse_organizations" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_organizations_uq" ON "inventory"."warehouse_organizations" ("warehouse_id","organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse_organizations" ADD CONSTRAINT "warehouse_organizations_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Hand-written (ERP-0031 Slice 1): backfill one link per warehouse that still
-- carries an organization_id, then freeze the column at NULL (ADR-0010, D1) —
-- scope moves to the link table while the column stays (migrations are
-- append-only). ASCII-only: the DB client encoding is WIN1252.
INSERT INTO "inventory"."warehouse_organizations" ("warehouse_id", "organization_id", "created_at")
SELECT w."id", w."organization_id", EXTRACT(EPOCH FROM NOW())::bigint
FROM "inventory"."warehouses" w
WHERE w."organization_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "inventory"."warehouse_organizations" wo
    WHERE wo."warehouse_id" = w."id"
      AND wo."organization_id" = w."organization_id"
      AND wo."deleted_at" IS NULL
  );--> statement-breakpoint
UPDATE "inventory"."warehouses" SET "organization_id" = NULL WHERE "organization_id" IS NOT NULL;