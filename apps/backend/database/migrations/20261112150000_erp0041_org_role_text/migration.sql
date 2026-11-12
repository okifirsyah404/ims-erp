-- ERP-0041: multi-role invitations — org_role Postgres enum -> text.
-- Hand-written (append-only; follows the hand-written migration convention
-- of 20261107090000 and 20261112120000).
--
-- Roles are now comma-joined in plain text, the same storage shape Better
-- Auth uses for auth.members.role, so one member/invite can carry several
-- closed-enum roles ('admin,finance'). Validity moves entirely to the zod
-- closed enum at every boundary (erpRoleNames in @ims-erp/common).
--
-- The enum type is recreated transiently if it is missing (the column may
-- exist only in databases that ran the 20261107090000 migration; a fresh
-- database replaying the full history always has it), converted via USING,
-- then dropped for good.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = 'organization_role' AND n.nspname = 'auth'
	) THEN
		CREATE TYPE "auth"."organization_role" AS ENUM ('owner', 'admin', 'member', 'operations_manager', 'sales_manager', 'sales', 'project_manager', 'technician', 'freelancer', 'purchasing', 'warehouse', 'finance', 'accountant', 'hr', 'customer_service', 'marketing', 'investor', 'customer', 'auditor');
	END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "auth"."user_invitations"
	ALTER COLUMN "org_role" TYPE text
	USING "org_role"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "auth"."organization_role";
