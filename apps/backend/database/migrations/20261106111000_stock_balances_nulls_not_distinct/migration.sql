-- A balance without a storage bin (bin_id NULL) must be one row per
-- (scope, warehouse, item). Plain unique indexes treat NULLs as distinct, so
-- every ON CONFLICT upsert of a bin-less balance inserted a new row instead of
-- incrementing the existing one. Merge the duplicates into the oldest row, then
-- rebuild both partial indexes as NULLS NOT DISTINCT (PostgreSQL 15+).
-- Cost columns keep the survivor's values; run the balance recompute repair
-- afterwards on any database that already holds duplicates.
WITH ranked AS (
	SELECT
		id,
		first_value(id) OVER w AS keep_id,
		sum(quantity_on_hand) OVER w AS on_hand,
		sum(quantity_reserved) OVER w AS reserved,
		max(last_movement_at) OVER w AS last_at
	FROM inventory.stock_balances
	WHERE bin_id IS NULL
	WINDOW w AS (
		PARTITION BY organization_id, warehouse_id, item_id
		ORDER BY created_at, id
		ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
	)
),
merged AS (
	UPDATE inventory.stock_balances b
	SET
		quantity_on_hand = r.on_hand,
		quantity_reserved = r.reserved,
		quantity_available = r.on_hand - r.reserved,
		last_movement_at = r.last_at
	FROM ranked r
	WHERE b.id = r.id AND r.id = r.keep_id
	RETURNING b.id
)
DELETE FROM inventory.stock_balances b
USING ranked r
WHERE b.id = r.id AND r.id <> r.keep_id;
--> statement-breakpoint
DROP INDEX "inventory"."stock_balances_org_scope_uq";
--> statement-breakpoint
DROP INDEX "inventory"."stock_balances_global_scope_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_org_scope_uq" ON "inventory"."stock_balances" ("organization_id","warehouse_id","item_id","bin_id") NULLS NOT DISTINCT WHERE organization_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_global_scope_uq" ON "inventory"."stock_balances" ("warehouse_id","item_id","bin_id") NULLS NOT DISTINCT WHERE organization_id IS NULL;
