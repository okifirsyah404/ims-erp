-- ERP-0185 / P7-4 (K2, K2b, K2d): data-only migration, no DDL.
--
-- The organization roles `admin`, `sales_manager`, `accountant` and `auditor`
-- left the closed role catalog (`erpRoleNames`, a zod enum), so any stored
-- role list naming them would fail validation on the next edit. Every stored
-- organization role list is rewritten the same way:
--   1. `sales_manager` becomes `sales` (the only sales role now);
--   2. `admin`, `accountant` and `auditor` are dropped without a mapping
--      (the owner re-assigns people after release);
--   3. the base `member` role is put first (every member carries it, the
--      backend adds it on every write from now on);
--   4. duplicates and blanks are dropped; the first position wins.
-- Lists are stored comma-joined without spaces, e.g.
-- 'sales_manager, sales, warehouse' -> 'member,sales,warehouse' and
-- 'auditor' -> 'member'. Idempotent: a second run changes no row.
--
-- Columns: auth.members.role (Better Auth membership, NOT NULL),
-- auth.user_invitations.org_role (ERP invitations, org path only) and
-- auth.invitations.role (Better Auth invitations, unused by the ERP flow but
-- kept consistent).

UPDATE auth.members AS m
SET role = normalized.new_role
FROM (
	SELECT id, string_agg(r, ',' ORDER BY first_ord) AS new_role
	FROM (
		SELECT id, r, min(ord) AS first_ord
		FROM (
			SELECT id, 'member'::text AS r, 0::bigint AS ord FROM auth.members
			UNION ALL
			SELECT src.id,
				CASE trim(x.r) WHEN 'sales_manager' THEN 'sales' ELSE trim(x.r) END,
				x.ord
			FROM auth.members AS src,
				unnest(string_to_array(src.role, ',')) WITH ORDINALITY AS x(r, ord)
		) AS expanded
		WHERE r <> '' AND r NOT IN ('admin', 'accountant', 'auditor')
		GROUP BY id, r
	) AS deduped
	GROUP BY id
) AS normalized
WHERE normalized.id = m.id
	AND m.role IS DISTINCT FROM normalized.new_role;
--> statement-breakpoint
UPDATE auth.user_invitations AS i
SET org_role = normalized.new_role
FROM (
	SELECT id, string_agg(r, ',' ORDER BY first_ord) AS new_role
	FROM (
		SELECT id, r, min(ord) AS first_ord
		FROM (
			SELECT id, 'member'::text AS r, 0::bigint AS ord
			FROM auth.user_invitations WHERE org_role IS NOT NULL
			UNION ALL
			SELECT src.id,
				CASE trim(x.r) WHEN 'sales_manager' THEN 'sales' ELSE trim(x.r) END,
				x.ord
			FROM auth.user_invitations AS src,
				unnest(string_to_array(src.org_role, ',')) WITH ORDINALITY AS x(r, ord)
			WHERE src.org_role IS NOT NULL
		) AS expanded
		WHERE r <> '' AND r NOT IN ('admin', 'accountant', 'auditor')
		GROUP BY id, r
	) AS deduped
	GROUP BY id
) AS normalized
WHERE normalized.id = i.id
	AND i.org_role IS DISTINCT FROM normalized.new_role;
--> statement-breakpoint
UPDATE auth.invitations AS i
SET role = normalized.new_role
FROM (
	SELECT id, string_agg(r, ',' ORDER BY first_ord) AS new_role
	FROM (
		SELECT id, r, min(ord) AS first_ord
		FROM (
			SELECT id, 'member'::text AS r, 0::bigint AS ord
			FROM auth.invitations WHERE role IS NOT NULL
			UNION ALL
			SELECT src.id,
				CASE trim(x.r) WHEN 'sales_manager' THEN 'sales' ELSE trim(x.r) END,
				x.ord
			FROM auth.invitations AS src,
				unnest(string_to_array(src.role, ',')) WITH ORDINALITY AS x(r, ord)
			WHERE src.role IS NOT NULL
		) AS expanded
		WHERE r <> '' AND r NOT IN ('admin', 'accountant', 'auditor')
		GROUP BY id, r
	) AS deduped
	GROUP BY id
) AS normalized
WHERE normalized.id = i.id
	AND i.role IS DISTINCT FROM normalized.new_role;
