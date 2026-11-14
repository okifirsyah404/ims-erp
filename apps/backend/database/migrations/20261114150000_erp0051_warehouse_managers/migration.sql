-- ERP-0051 Phase 1 (ADR-0017): per-user, per-warehouse person-in-charge grant.
-- Hand-written, append-only (same convention as 20261113150000 / 20261114120000:
-- no snapshot.json, because `drizzle-kit generate` is still blocked by the
-- pre-existing duplicate `finance.receipts` creation recorded as ERP-0052).
--
-- A PIC is a second access path to warehouses only: read, update, archive,
-- import, export. Create stays application-admin-only, and stock stays on the
-- organization `warehouse` role plus the warehouse->organization link. The grant
-- deliberately ignores that link (ADR-0017 decision 3), so a PIC keeps access
-- when their warehouse is not linked to their active organization.
--
-- `user_id` and `assigned_by` are logical references to auth.users.id. The
-- cross-module FK is intentionally omitted (ADR-0014) and they stay nullable;
-- the service asserts the user exists before writing an assignment, and a NULL
-- `user_id` row grants nothing.

CREATE TABLE IF NOT EXISTS "inventory"."warehouse_managers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"warehouse_id" uuid NOT NULL,
	"user_id" text,
	"assigned_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	CONSTRAINT "warehouse_managers_warehouse_id_warehouses_id_fkey"
		FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouses"("id")
		ON DELETE CASCADE
);

-- One live assignment per (warehouse, user); a soft-deleted row does not block
-- re-assignment. PostgreSQL treats every NULL as distinct, so a NULL user_id
-- cannot collide - the service never writes one.
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_managers_uq"
	ON "inventory"."warehouse_managers" ("warehouse_id", "user_id")
	WHERE "deleted_at" IS NULL;

-- `GET /inventory/warehouses/mine` looks the caller up by user_id alone.
CREATE INDEX IF NOT EXISTS "warehouse_managers_user_id_idx"
	ON "inventory"."warehouse_managers" ("user_id");
