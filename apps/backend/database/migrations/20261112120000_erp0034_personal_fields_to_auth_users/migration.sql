-- ERP-0034: move personal fields from hr.employees to auth.users.
-- Columns moved: gender, birth_date, birth_place, marital_status.
-- Hand-written (same convention as 20261112000000_erp0034_hr_employees).
--
-- Fail-fast: an employee row without user_id cannot hand its values to a
-- user, so if any such row carries a value, the migration aborts before any
-- data is changed. Nothing is dropped silently.
DO $$
DECLARE
	orphan_count integer;
BEGIN
	SELECT count(*) INTO orphan_count
	FROM "hr"."employees"
	WHERE "user_id" IS NULL
		AND ("gender" IS NOT NULL
			OR "birth_date" IS NOT NULL
			OR "birth_place" IS NOT NULL
			OR "marital_status" IS NOT NULL);
	IF orphan_count > 0 THEN
		RAISE EXCEPTION 'ERP-0034: % hr.employees row(s) have personal fields but no user_id; resolve them before migrating', orphan_count;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "gender" text;
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "birth_date" bigint;
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "birth_place" text;
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "marital_status" text;
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_gender_check" CHECK ("gender" IS NULL OR "gender" IN ('male', 'female'));
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_marital_status_check" CHECK ("marital_status" IS NULL OR "marital_status" IN ('single', 'married', 'divorced', 'widowed'));
--> statement-breakpoint
-- Copy values from employees that are linked to a user. A user can have at
-- most one alive employee (hr_employees_user_uq), so the join is 1:1 for
-- live rows. Soft-deleted employees are copied too only when the user has no
-- value yet, so no historical value that is still present gets lost.
UPDATE "auth"."users" u
SET
	"gender" = e."gender",
	"birth_date" = e."birth_date",
	"birth_place" = e."birth_place",
	"marital_status" = e."marital_status"
FROM "hr"."employees" e
WHERE e."user_id" = u."id"
	AND e."deleted_at" IS NULL
	AND (e."gender" IS NOT NULL OR e."birth_date" IS NOT NULL OR e."birth_place" IS NOT NULL OR e."marital_status" IS NOT NULL);
--> statement-breakpoint
UPDATE "auth"."users" u
SET
	"gender" = COALESCE(u."gender", e."gender"),
	"birth_date" = COALESCE(u."birth_date", e."birth_date"),
	"birth_place" = COALESCE(u."birth_place", e."birth_place"),
	"marital_status" = COALESCE(u."marital_status", e."marital_status")
FROM "hr"."employees" e
WHERE e."user_id" = u."id"
	AND e."deleted_at" IS NOT NULL
	AND (e."gender" IS NOT NULL OR e."birth_date" IS NOT NULL OR e."birth_place" IS NOT NULL OR e."marital_status" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "hr"."employees" DROP COLUMN "gender";
--> statement-breakpoint
ALTER TABLE "hr"."employees" DROP COLUMN "birth_date";
--> statement-breakpoint
ALTER TABLE "hr"."employees" DROP COLUMN "birth_place";
--> statement-breakpoint
ALTER TABLE "hr"."employees" DROP COLUMN "marital_status";
