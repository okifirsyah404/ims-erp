CREATE SCHEMA "payment";
--> statement-breakpoint
CREATE TABLE "payment"."gateways" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"provider" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'sandbox' NOT NULL,
	"config" jsonb,
	"secret_ciphertext" text,
	"secret_iv" text,
	"secret_tag" text,
	"secret_last4" varchar(4),
	"key_version" smallint DEFAULT 1 NOT NULL,
	"webhook_token_ciphertext" text,
	"webhook_token_iv" text,
	"webhook_token_tag" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"rotated_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "gateways_provider_check" CHECK (provider IN ('xendit', 'singapay', 'fake')),
	CONSTRAINT "gateways_mode_check" CHECK (mode IN ('sandbox', 'live')),
	CONSTRAINT "gateways_key_version_check" CHECK (key_version > 0)
);
--> statement-breakpoint
CREATE TABLE "payment"."payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"payment_id" uuid NOT NULL,
	"payable_type" text NOT NULL,
	"payable_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"allocated_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payment_allocations_payable_type_check" CHECK (payable_type IN ('sale_invoice', 'supplier_bill', 'employee_advance', 'expense_claim', 'expense_settlement', 'employee_salary_record')),
	CONSTRAINT "payment_allocations_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "payment"."code_numberings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code_type" varchar(32) NOT NULL,
	"pattern" varchar(100),
	"reset_policy" text,
	"period_key" varchar(7) NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payment_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "payment_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "payment"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"description" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "payment"."payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"payment_type" text NOT NULL,
	"direction" text NOT NULL,
	"channel" text DEFAULT 'manual' NOT NULL,
	"gateway_id" uuid,
	"provider" text,
	"provider_reference" varchar(100),
	"payment_url" text,
	"expires_at" bigint,
	"paid_at" bigint,
	"paid_amount" bigint,
	"payment_channel" text,
	"provider_transaction_id" varchar(100),
	"receipt_id" uuid,
	"settlement_note" text,
	"last_event" jsonb,
	"counterparty_type" text,
	"counterparty_id" text,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"payment_method" text DEFAULT 'bank_transfer' NOT NULL,
	"payment_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"requested_by" text,
	"requested_at" bigint,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"executed_by" text,
	"executed_at" bigint,
	"cash_bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"voided_at" bigint,
	"void_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "payments_type_check" CHECK (payment_type IN ('receipt', 'disbursement', 'refund', 'advance_disbursement', 'payroll', 'profit_distribution', 'investment')),
	CONSTRAINT "payments_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "payments_channel_check" CHECK (channel IN ('manual', 'gateway')),
	CONSTRAINT "payments_provider_check" CHECK (provider IS NULL OR provider IN ('xendit', 'singapay', 'fake')),
	CONSTRAINT "payments_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'executed', 'pending', 'paid', 'expired', 'failed', 'reversed', 'void', 'cancelled')),
	CONSTRAINT "payments_amount_check" CHECK (amount > 0),
	CONSTRAINT "payments_paid_amount_check" CHECK (paid_amount IS NULL OR paid_amount >= 0),
	CONSTRAINT "payments_method_check" CHECK (payment_method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque', 'offset'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "gateways_org_provider_code_uq" ON "payment"."gateways" ("organization_id","provider","code");--> statement-breakpoint
CREATE INDEX "gateways_provider_idx" ON "payment"."gateways" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_uq" ON "payment"."payment_allocations" ("payment_id","payable_type","payable_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payable_idx" ON "payment"."payment_allocations" ("payable_type","payable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_code_numberings_type_uq" ON "payment"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_settings_scope_uq" ON "payment"."settings" ("organization_id","setting_group","setting_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_org_code_uq" ON "payment"."payments" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payment"."payments" ("status");--> statement-breakpoint
CREATE INDEX "payments_counterparty_idx" ON "payment"."payments" ("organization_id","counterparty_type","counterparty_id");--> statement-breakpoint
CREATE INDEX "payments_cash_bank_account_id_idx" ON "payment"."payments" ("cash_bank_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_uq" ON "payment"."payments" ("provider","provider_reference") WHERE provider_reference IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_receipt_id_uq" ON "payment"."payments" ("receipt_id") WHERE receipt_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"."payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment"."payments" ADD CONSTRAINT "payments_gateway_id_gateways_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment"."gateways"("id") ON DELETE SET NULL;