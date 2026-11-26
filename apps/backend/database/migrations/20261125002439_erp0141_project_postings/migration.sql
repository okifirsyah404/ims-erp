ALTER TABLE "project"."costs" ADD COLUMN "payment_source" text DEFAULT 'employee_claim' NOT NULL;--> statement-breakpoint
ALTER TABLE "project"."costs" ADD COLUMN "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "project"."costs" ADD COLUMN "journal_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "sale"."invoices" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "project"."costs" ADD CONSTRAINT "costs_payment_source_check" CHECK ("payment_source" IN ('employee_claim', 'petty_cash', 'bank'));--> statement-breakpoint
ALTER TABLE "finance"."journal_entries" DROP CONSTRAINT "journal_entries_source_module_check", ADD CONSTRAINT "journal_entries_source_module_check" CHECK (source_module IN ('finance', 'sale', 'procurement', 'inventory', 'payment', 'tax', 'human_resource', 'project'));