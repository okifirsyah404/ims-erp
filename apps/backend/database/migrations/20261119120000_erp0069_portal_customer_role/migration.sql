-- ERP-0069 (ADR-0024): the customer portal guard now requires the global
-- Better Auth role `customer` on top of an active portal identity. Data-only
-- backfill, hand-written (no schema change, so no snapshot): every user with a
-- live customer portal identity gets `customer` appended to `auth.users.role`
-- (comma-joined, admin plugin). The default `user` role is replaced; any other
-- role is kept. Idempotent: users that already carry `customer` are skipped.
UPDATE "auth"."users" AS u
SET "role" = CASE
		WHEN u."role" IS NULL OR btrim(u."role") = '' OR btrim(u."role") = 'user' THEN 'customer'
		ELSE u."role" || ',customer'
	END
WHERE u."id" IN (
		SELECT pi."user_id"
		FROM "auth"."portal_identities" AS pi
		WHERE pi."deleted_at" IS NULL
			AND pi."portal_type" = 'customer'
	)
	AND NOT ('customer' = ANY (string_to_array(replace(coalesce(u."role", ''), ' ', ''), ',')));
