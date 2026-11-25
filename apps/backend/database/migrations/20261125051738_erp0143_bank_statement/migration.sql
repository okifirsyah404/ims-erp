ALTER TABLE "finance"."bank_reconciliation_items" ADD COLUMN "statement_date" date;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD COLUMN "direction" text;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD COLUMN "match_method" text;--> statement-breakpoint
ALTER TABLE "finance"."cash_bank_accounts" ADD COLUMN "statement_mapping" jsonb;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_direction_check" CHECK (direction IS NULL OR direction IN ('in', 'out'));--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation_items" ADD CONSTRAINT "bank_reconciliation_items_match_method_check" CHECK (match_method IS NULL OR match_method IN ('auto', 'manual', 'created'));