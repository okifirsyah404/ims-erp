ALTER TABLE "supplier"."companies" DROP CONSTRAINT "supplier_companies_payment_terms_check";--> statement-breakpoint
ALTER TABLE "supplier"."companies" DROP COLUMN "whatsapp";--> statement-breakpoint
ALTER TABLE "supplier"."companies" DROP COLUMN "payment_terms_days";--> statement-breakpoint
ALTER TABLE "supplier"."companies" DROP COLUMN "payment_term_note";--> statement-breakpoint
ALTER TABLE "supplier"."suppliers" DROP COLUMN "whatsapp";