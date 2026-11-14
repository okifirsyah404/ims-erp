-- ERP-0020: online payment checkouts of sales invoices (ADR-0019).
-- Hand-written, append-only (same convention as 20261113090000: no
-- snapshot.json, the repo carries no drizzle-kit journal).
--
-- One row per checkout opened at a payment gateway (Xendit or SingaPay,
-- chosen by configuration; `fake` only outside production). The row id is the
-- merchant reference sent to the provider, so a webhook finds its row without
-- a tenant. A paid checkout posts one sales.receipts row (receipt_id); the
-- partial unique index makes that at most one.

CREATE TABLE IF NOT EXISTS "sales"."gateway_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" varchar(100),
	"payment_url" text,
	"amount" bigint NOT NULL,
	"currency_code" varchar(3) NOT NULL DEFAULT 'IDR',
	"status" text NOT NULL DEFAULT 'pending',
	"expires_at" bigint,
	"paid_at" bigint,
	"paid_amount" bigint,
	"payment_channel" text,
	"provider_transaction_id" varchar(100),
	"receipt_id" uuid,
	"settlement_note" text,
	"last_event" jsonb,
	"requested_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "gateway_payments_sales_invoice_id_invoices_id_fkey"
		FOREIGN KEY ("sales_invoice_id") REFERENCES "sales"."invoices"("id") ON DELETE RESTRICT,
	CONSTRAINT "gateway_payments_receipt_id_receipts_id_fkey"
		FOREIGN KEY ("receipt_id") REFERENCES "sales"."receipts"("id") ON DELETE RESTRICT,
	CONSTRAINT "gateway_payments_provider_check"
		CHECK ("provider" IN ('xendit', 'singapay', 'fake')),
	CONSTRAINT "gateway_payments_status_check"
		CHECK ("status" IN ('pending', 'paid', 'expired', 'failed')),
	CONSTRAINT "gateway_payments_amount_check" CHECK ("amount" > 0),
	CONSTRAINT "gateway_payments_paid_amount_check"
		CHECK ("paid_amount" IS NULL OR "paid_amount" >= 0)
);

CREATE INDEX IF NOT EXISTS "gateway_payments_sales_invoice_id_idx"
	ON "sales"."gateway_payments" ("sales_invoice_id");
CREATE INDEX IF NOT EXISTS "gateway_payments_status_idx"
	ON "sales"."gateway_payments" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "gateway_payments_provider_reference_uq"
	ON "sales"."gateway_payments" ("provider", "provider_reference")
	WHERE "provider_reference" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "gateway_payments_receipt_id_uq"
	ON "sales"."gateway_payments" ("receipt_id")
	WHERE "receipt_id" IS NOT NULL;
