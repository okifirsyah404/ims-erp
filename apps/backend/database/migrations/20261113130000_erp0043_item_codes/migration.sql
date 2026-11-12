-- ERP-0043: item master codes per kind + a serial number on the item master.
-- Hand-written, append-only (same convention as 2026111312*).
--
-- `inventory.items` gains:
--   code          allocated by the numbering authority (PRD/MAT/CMP)
--   serial_number optional manufacturer serial of a serialized item master
-- and `code_number.series` gains the three item code types.
--
-- Existing rows get a generated code in creation order per kind. This is a
-- synthetic backfill, not a rename of an existing value: before ERP-0043 an
-- item had only `sku`, and `sku` stays exactly as it is.

ALTER TABLE "inventory"."items" ADD COLUMN IF NOT EXISTS "code" varchar(32);
ALTER TABLE "inventory"."items" ADD COLUMN IF NOT EXISTS "serial_number" text;

-- Deterministic backfill: one counter per kind, ordered by creation.
WITH numbered AS (
	SELECT
		"id",
		"item_kind",
		ROW_NUMBER() OVER (PARTITION BY "item_kind" ORDER BY "created_at", "id") AS rn
	FROM "inventory"."items"
	WHERE "code" IS NULL
)
UPDATE "inventory"."items" AS i
SET "code" = CASE numbered."item_kind"
	WHEN 'product' THEN 'PRD-' || LPAD(numbered.rn::text, 5, '0')
	WHEN 'material' THEN 'MAT-' || LPAD(numbered.rn::text, 5, '0')
	WHEN 'component' THEN 'CMP-' || LPAD(numbered.rn::text, 5, '0')
	ELSE 'CMP-' || LPAD(numbered.rn::text, 5, '0')
END
FROM numbered
WHERE i."id" = numbered."id";

ALTER TABLE "inventory"."items" ALTER COLUMN "code" SET NOT NULL;

-- Code uniqueness follows the same scope split as `sku` (ADR-0008): the
-- partial index pair, because a unique index ignores NULL organization ids.
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_org_code_uq"
	ON "inventory"."items" ("organization_id", "code")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_global_code_uq"
	ON "inventory"."items" ("code")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NULL;

-- Series rows so the next allocation continues after the backfill instead of
-- handing out a code that is already taken. Existing rows win: a re-run (or a
-- database that already allocated item codes) never moves the counter back.
INSERT INTO "code_number"."series" (
	"module", "code_type", "pattern", "reset_policy", "period_key",
	"next_number", "created_at", "updated_at"
)
SELECT
	'inventory',
	kind.code_type,
	NULL,
	'never',
	'all',
	COALESCE(used.n, 0) + 1,
	(EXTRACT(EPOCH FROM now()) * 1000)::bigint,
	(EXTRACT(EPOCH FROM now()) * 1000)::bigint
FROM (
	VALUES ('item_product'), ('item_material'), ('item_component')
) AS kind(code_type)
LEFT JOIN (
	SELECT
		CASE "item_kind"
			WHEN 'product' THEN 'item_product'
			WHEN 'material' THEN 'item_material'
			ELSE 'item_component'
		END AS code_type,
		COUNT(*) AS n
	FROM "inventory"."items"
	GROUP BY 1
) AS used ON used.code_type = kind.code_type
WHERE NOT EXISTS (
	SELECT 1
	FROM "code_number"."series" s
	WHERE s."code_type" = kind.code_type AND s."deleted_at" IS NULL
);
