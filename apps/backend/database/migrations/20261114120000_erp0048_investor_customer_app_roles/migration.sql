-- ADR-0018: investor and customer leave the organization roles and become
-- application roles (`user.role`, Better Auth admin()).
--
-- Hand-written, append-only (same convention as 20261113150000: no
-- snapshot.json). Dev-only: no production server runs yet, so existing
-- investor/customer memberships are deleted rather than migrated.
--
-- `members.role` is comma-joined text (ERP-0041), so a row can carry several
-- roles. Rows whose roles are all portal roles are deleted. Rows that mix a
-- portal role with an internal role keep the internal roles only. An empty
-- role that did not come from a portal role is left alone - deleting every
-- empty row would be collateral damage outside this migration's intent.

-- 1. Delete memberships that held only portal roles.
DELETE FROM "auth"."members"
WHERE "role" ~ '(^|,)\s*(investor|customer)\s*(,|$)'
	AND NOT EXISTS (
		SELECT 1
		FROM unnest(string_to_array("role", ',')) AS r
		WHERE btrim(r) <> '' AND btrim(r) NOT IN ('investor', 'customer')
	);
--> statement-breakpoint

-- 2. Remove the portal roles from the remaining (mixed) rows.
UPDATE "auth"."members"
SET "role" = array_to_string(
	ARRAY(
		SELECT btrim(r)
		FROM unnest(string_to_array("role", ',')) AS r
		WHERE btrim(r) NOT IN ('investor', 'customer')
	),
	','
)
WHERE "role" ~ '(^|,)\s*(investor|customer)\s*(,|$)';
--> statement-breakpoint

-- 3. Pending invitations for the removed roles (org_role is text, ERP-0041).
UPDATE "auth"."user_invitations"
SET "org_role" = NULL
WHERE "org_role" IN ('investor', 'customer');
