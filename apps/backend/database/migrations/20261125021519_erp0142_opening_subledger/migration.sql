CREATE TABLE "finance"."opening_subledger_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"ledger" text NOT NULL,
	"customer_id" uuid,
	"supplier_company_id" uuid,
	"party_code" varchar(32) NOT NULL,
	"party_name" text NOT NULL,
	"document_number" varchar(100) NOT NULL,
	"document_date" date NOT NULL,
	"due_date" date,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"as_of_date" date NOT NULL,
	"ar_open_item_id" uuid,
	"supplier_bill_id" uuid,
	"ap_open_item_id" uuid,
	"posted_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "opening_subledger_items_currency_idr_check" CHECK (currency_code = 'IDR'),
	CONSTRAINT "opening_subledger_items_ledger_check" CHECK (ledger IN ('ar', 'ap')),
	CONSTRAINT "opening_subledger_items_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "opening_subledger_items_document_uq" ON "finance"."opening_subledger_items" ("organization_id","ledger","document_number") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "opening_subledger_items_ledger_idx" ON "finance"."opening_subledger_items" ("organization_id","ledger","posted_at");--> statement-breakpoint
ALTER TABLE "finance"."opening_subledger_items" ADD CONSTRAINT "opening_subledger_items_ar_open_item_id_ar_open_items_id_fkey" FOREIGN KEY ("ar_open_item_id") REFERENCES "finance"."ar_open_items"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."opening_subledger_items" ADD CONSTRAINT "opening_subledger_items_supplier_bill_id_supplier_bills_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "finance"."supplier_bills"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."opening_subledger_items" ADD CONSTRAINT "opening_subledger_items_ap_open_item_id_ap_open_items_id_fkey" FOREIGN KEY ("ap_open_item_id") REFERENCES "finance"."ap_open_items"("id") ON DELETE SET NULL;