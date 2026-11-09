DROP TYPE IF EXISTS "auth"."organization_role";--> statement-breakpoint
CREATE TYPE "auth"."organization_role" AS ENUM ('owner', 'admin', 'member', 'operations_manager', 'sales_manager', 'sales', 'project_manager', 'technician', 'freelancer', 'purchasing', 'warehouse', 'finance', 'accountant', 'hr', 'customer_service', 'marketing', 'investor', 'customer', 'auditor');--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" ADD COLUMN "org_role" "auth"."organization_role";--> statement-breakpoint
UPDATE "auth"."user_invitations" AS "ui"
SET "org_role" = (
	SELECT CASE
		WHEN "r"."name" IN ('owner', 'admin', 'member', 'operations_manager', 'sales_manager', 'sales', 'project_manager', 'technician', 'freelancer', 'purchasing', 'warehouse', 'finance', 'accountant', 'hr', 'customer_service', 'marketing', 'investor', 'customer', 'auditor')
		THEN "r"."name"::"auth"."organization_role"
		ELSE 'member'::"auth"."organization_role"
	END
	FROM "auth"."roles" AS "r"
	WHERE "r"."id" = "ui"."role_id"
) WHERE "ui"."role_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" DROP CONSTRAINT "user_invitations_role_id_roles_id_fkey";--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" DROP COLUMN "role_id";--> statement-breakpoint
DROP INDEX IF EXISTS "auth"."roles_org_name_live_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "auth"."roles_organizationId_idx";--> statement-breakpoint
DROP TABLE "auth"."roles";
