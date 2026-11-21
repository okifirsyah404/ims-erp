-- ERP-0094 (ADR-0027): the customer portal guard now requires the global
-- Better Auth role `customer` on top of an active portal login. Data-only
-- backfill, hand-written into a `drizzle-kit generate --custom` folder (no
-- schema change: the snapshot carries no deltas). Every user behind a live
-- portal login - a `customer.customers` row with `user_id` set and not
-- soft-deleted (revoking frees `user_id`; a suspended login keeps it and is
-- still refused by the guard's `portal_status = 'active'` check) - gets
-- `customer` added to `auth.users.role` (comma-joined, admin plugin). The
-- default `user` role is replaced; any other role is kept (same rule as
-- `BetterAuthUserAccountGateway.grantCustomerRole`). Idempotent: users
-- that already carry `customer` are skipped.
UPDATE "auth"."users" AS u
SET "role" = array_to_string(
		array_remove(array_remove(string_to_array(replace(coalesce(u."role", ''), ' ', ''), ','), 'user'), '') || ARRAY['customer'],
		','
	)
WHERE u."id" IN (
		SELECT c."user_id"
		FROM "customer"."customers" AS c
		WHERE c."user_id" IS NOT NULL
			AND c."deleted_at" IS NULL
	)
	AND NOT ('customer' = ANY (string_to_array(replace(coalesce(u."role", ''), ' ', ''), ',')));
