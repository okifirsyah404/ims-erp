ALTER TABLE "customer"."customers" ADD COLUMN "portal_language" text;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD COLUMN "portal_two_step" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD COLUMN "portal_push" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD CONSTRAINT "customers_portal_language_check" CHECK ("portal_language" IS NULL OR "portal_language" IN ('en', 'id'));