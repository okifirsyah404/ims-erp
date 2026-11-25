ALTER TABLE "payment"."payments" ADD COLUMN "withholding_tax_id" uuid;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD COLUMN "withholding_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD COLUMN "tax_object_code" varchar(20);--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD COLUMN "tax_object_code" varchar(20);--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD COLUMN "withholding_slip_number" varchar(40);--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD COLUMN "counterparty_tax_id" varchar(32);--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD COLUMN "source_module" text;--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD COLUMN "coretax_status" text DEFAULT 'not_exported' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_withholding_check" CHECK (withholding_amount >= 0 AND withholding_amount < amount);--> statement-breakpoint
ALTER TABLE "tax"."withholding_tax_records" ADD CONSTRAINT "withholding_coretax_status_check" CHECK (coretax_status IN ('not_exported', 'exported', 'uploaded'));