ALTER TABLE "finance"."supplier_bill_items" ADD COLUMN "grir_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_returns" ADD COLUMN "journal_entry_id" uuid;