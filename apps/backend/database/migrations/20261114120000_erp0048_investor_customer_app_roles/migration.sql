-- ADR-0018: investor and customer leave the organization roles and become
-- application roles (`user.role`, Better Auth admin()).
--
-- Hand-written, append-only (same convention as 20261113150000: no
-- snapshot.json). Dev-only: no production server runs yet, so existing
-- investor/customer memberships are deleted rather than migrated.
--
-- `members.role` is comma-joined text (ERP-0041), so a row can carry several
-- roles. Rows whose roles are all portal roles are deleted. Rows that mix a
-- portal role with an internal role keep the internal roles only.

-- 1. Remove the portal roles from mixed rows (keep the internal roles).
UPDATE "auth"."members"
SET "role" = array_to_string(
	ARRAY(
		SELECT r
		FROM unnest(string_to_array("role", ',')) AS r
		WHERE btrim(r) NOT IN ('investor', 'customer')
	),
	','
)
WHERE "role" ~ '(^|,)\s*(investor|customer)\s*(,|$)';
--> statement-breakpoint

-- 2. Delete memberships that held only portal roles (now empty).
DELETE FROM "auth"."members"
WHERE btrim("role") = '';
--> statement-breakpoint

-- 3. Pending invitations for the removed roles (org_role is text, ERP-0041).
UPDATE "auth"."user_invitations"
SET "org_role" = NULL
WHERE "org_role" IN ('investor', 'customer');
