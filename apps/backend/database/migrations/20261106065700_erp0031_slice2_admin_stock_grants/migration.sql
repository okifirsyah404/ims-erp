-- ERP-0031 Slice 2: grant organization admins read/export access to the stock
-- ledger and read access to adjustments.
--
-- Grants live in `auth.roles.permissions` (jsonb) and the role seeder is
-- insert-only, so already-seeded organizations need this data-only migration
-- to pick the new grants up. Matches `erpRoleGrants.admin` in
-- packages/common/src/authorization/erp-permissions.ts:
--   stock: ['read', 'export'], stock_adjustment: ['read'].
--
-- Idempotent: a row that already has the keys is left alone. Other roles are
-- untouched — receiving/issuing stays with the warehouse role.
UPDATE "auth"."roles"
SET "permissions" =
	jsonb_set(
		jsonb_set(
			"permissions",
			'{stock}',
			CASE
				WHEN "permissions" -> 'stock' IS NULL THEN '["read", "export"]'::jsonb
				ELSE (
					SELECT jsonb_agg(DISTINCT action)
					FROM jsonb_array_elements_text(
						"permissions" -> 'stock' || '["read", "export"]'::jsonb
					) AS action
				)
			END
		),
		'{stock_adjustment}',
		CASE
			WHEN "permissions" -> 'stock_adjustment' IS NULL THEN '["read"]'::jsonb
			ELSE (
				SELECT jsonb_agg(DISTINCT action)
				FROM jsonb_array_elements_text(
					"permissions" -> 'stock_adjustment' || '["read"]'::jsonb
				) AS action
			)
		END
	)
WHERE "name" = 'admin'
  AND "is_system" = true
  AND "deleted_at" IS NULL
  AND (
	-- `?` on a missing key (NULL) yields NULL, not false, so the missing-key
	-- case must fall through COALESCE to "not yet granted".
	NOT COALESCE("permissions" -> 'stock' ? 'read', false)
	OR NOT COALESCE("permissions" -> 'stock' ? 'export', false)
	OR NOT COALESCE("permissions" -> 'stock_adjustment' ? 'read', false)
  );--> statement-breakpoint

-- The where-clause guard above compares keys, but jsonb `?` on an array of
-- strings checks *values*, so a role holding `stock: ["read"]` but not
-- `export` is correctly caught. A role already holding both is skipped, so
-- re-running the migration is a no-op.
