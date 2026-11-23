DROP INDEX "customer"."customer_companies_owner_user_id_idx";--> statement-breakpoint
DROP INDEX "customer"."customers_primary_uq";--> statement-breakpoint
DROP INDEX "customer"."customers_owner_user_id_idx";--> statement-breakpoint
ALTER TABLE "customer"."companies" ADD COLUMN "owner_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD COLUMN "portal_password_change_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer"."companies" DROP COLUMN "whatsapp";--> statement-breakpoint
ALTER TABLE "customer"."companies" DROP COLUMN "owner_user_id";--> statement-breakpoint
ALTER TABLE "customer"."customers" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "customer"."customers" DROP COLUMN "whatsapp";--> statement-breakpoint
ALTER TABLE "customer"."customers" DROP COLUMN "is_primary";--> statement-breakpoint
ALTER TABLE "customer"."customers" DROP COLUMN "owner_user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "customer_companies_owner_uq" ON "customer"."companies" ("owner_customer_id") WHERE owner_customer_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "customer"."companies" ADD CONSTRAINT "companies_owner_customer_id_customers_id_fkey" FOREIGN KEY ("owner_customer_id") REFERENCES "customer"."customers"("id") ON DELETE SET NULL;