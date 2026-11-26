-- Custom SQL migration file, put your code below! --
-- ERP-0166: the two balance-scope unique indexes of inventory.stocks must treat
-- a NULL bin_id as one value (docs.dbml: NULLS NOT DISTINCT). Without it every
-- movement into a warehouse without a bin inserted a fresh balance row (the
-- repository's ON CONFLICT never fired) and the delta was then applied to all
-- of them, so one product held several identical balances.
-- drizzle-orm cannot declare NULLS NOT DISTINCT on a partial unique index, so
-- this hand-written step carries it; the Drizzle schema keeps the same index
-- names, columns and predicates. A database that already holds duplicate
-- balance rows must be repaired (recomputeFromLedger) before this runs.
DROP INDEX IF EXISTS "inventory"."stocks_org_scope_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_org_scope_uq" ON "inventory"."stocks" ("organization_id","warehouse_id","product_id","bin_id") NULLS NOT DISTINCT WHERE organization_id IS NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "inventory"."stocks_global_scope_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "stocks_global_scope_uq" ON "inventory"."stocks" ("warehouse_id","product_id","bin_id") NULLS NOT DISTINCT WHERE organization_id IS NULL;
