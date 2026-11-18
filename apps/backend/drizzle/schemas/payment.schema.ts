/**
 * Payment domain schema — owns the `payment` Postgres schema.
 *
 * Every money movement of the ERP lives here:
 * - `payment.payments` — THE single payment ledger (receipts and
 *   disbursements), with its approval lifecycle and its allocations to sales
 *   invoices and supplier bills. Moved out of `finance` by ADR-0024.
 * - `payment.payment_allocations` — one row per (payment, target document).
 * - `payment.gateway_payments` — online checkout of an invoice through a
 *   provider-neutral gateway (ERP-0020, ADR-0021, moved here by ADR-0023).
 *
 * House rules honoured here:
 * - One module = one schema = one schema file (`elysia-module` rule 3.1).
 * - Cross-module references are plain id columns with no FK, validated through
 *   the owning module's contract (`elysia-module` rule 3.2, ADR-0014): sales
 *   invoices, finance supplier bills / employee advances / cash/bank accounts,
 *   auth organizations and users.
 * - Money is bigint IDR minor units (ADR-0002); operational timestamps are
 *   unix ms.
 * - Status vocabularies are `text` guarded by CHECK constraints, never native
 *   enums.
 * - Soft delete via `deleted_at`; `payment_allocations` is cascade-deleted with
 *   its payment and documented as exempt in `validate-dbml.ts`.
 * - Relational v2 only (`defineRelationsPart`, `r.one`) — ADR-0004.
 */
import { defineRelationsPart } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
	bigint,
	check,
	date,
	index,
	jsonb,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const paymentSchema = pgSchema('payment');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Payment kinds. `advance_disbursement`, `payroll` etc. are Stage 2 values. */
export const PAYMENT_TYPES = [
	'receipt',
	'disbursement',
	'refund',
	'advance_disbursement',
	'payroll',
	'profit_distribution',
	'investment',
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** Money direction of a payment relative to the company. */
export const PAYMENT_DIRECTIONS = ['in', 'out'] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

/**
 * Payment lifecycle. `reversed` / `void` / `cancelled` exist in the
 * vocabulary and CHECK; reversal handling lands with the posting engine.
 */
export const PAYMENT_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'executed',
	'reversed',
	'void',
	'cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
	'bank_transfer',
	'cash',
	'card',
	'e_wallet',
	'cheque',
	'offset',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What an allocation settles. */
export const PAYMENT_ALLOCATION_TARGETS = ['sales_invoice', 'supplier_bill'] as const;
export type PaymentAllocationTarget = (typeof PAYMENT_ALLOCATION_TARGETS)[number];

export const GATEWAY_PROVIDERS = ['xendit', 'singapay', 'fake'] as const;
export type TGatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_PAYMENT_STATUSES = ['pending', 'paid', 'expired', 'failed'] as const;
export type TGatewayPaymentStatus = (typeof GATEWAY_PAYMENT_STATUSES)[number];

/* ------------------------------------------------------------------------ *
 * payment.payments — THE single payment ledger
 * ------------------------------------------------------------------------ */

export const payments = paymentSchema.table(
	'payments',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id (ADR-0014: no FK). */
		organizationId: text('organization_id').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		paymentType: text('payment_type').notNull(),
		direction: text('direction').notNull(),
		counterpartyType: text('counterparty_type'),
		counterpartyId: text('counterparty_id'),
		/** Logical references; validated through the owning module contracts. */
		salesInvoiceId: uuid('sales_invoice_id'),
		supplierBillId: uuid('supplier_bill_id'),
		employeeAdvanceId: uuid('employee_advance_id'),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		paymentMethod: text('payment_method').notNull().default('bank_transfer'),
		paymentDate: date('payment_date'),
		status: text('status').notNull().default('draft'),
		/** Logical reference to auth.users.id. */
		requestedBy: text('requested_by'),
		requestedAt: unixTimestampNullable('requested_at'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		executedBy: text('executed_by'),
		executedAt: unixTimestampNullable('executed_at'),
		/** Logical reference to finance.cash_bank_accounts.id (Finance owns the master). */
		cashBankAccountId: uuid('cash_bank_account_id'),
		referenceNumber: text('reference_number'),
		notes: text('notes'),
		voidedAt: unixTimestampNullable('voided_at'),
		voidReason: text('void_reason'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('payments_org_code_uq').on(table.organizationId, table.code),
		index('payments_sales_invoice_id_idx').on(table.salesInvoiceId),
		index('payments_supplier_bill_id_idx').on(table.supplierBillId),
		index('payments_employee_advance_id_idx').on(table.employeeAdvanceId),
		index('payments_status_idx').on(table.status),
		index('payments_counterparty_idx').on(table.organizationId, table.counterpartyType, table.counterpartyId),
		index('payments_cash_bank_account_id_idx').on(table.cashBankAccountId),
		check(
			'payments_type_check',
			sql`payment_type IN ('receipt', 'disbursement', 'refund', 'advance_disbursement', 'payroll', 'profit_distribution', 'investment')`,
		),
		check('payments_direction_check', sql`direction IN ('in', 'out')`),
		check(
			'payments_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'executed', 'reversed', 'void', 'cancelled')`,
		),
		check('payments_amount_check', sql`amount > 0`),
		check(
			'payments_method_check',
			sql`payment_method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque', 'offset')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * payment.payment_allocations — one payment against one target document
 * ------------------------------------------------------------------------ */

export const paymentAllocations = paymentSchema.table(
	'payment_allocations',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id. */
		organizationId: text('organization_id').notNull(),
		paymentId: uuid('payment_id')
			.notNull()
			.references(() => payments.id, { onDelete: 'cascade' }),
		/** Target document of the allocation: sales invoice or supplier bill. */
		targetType: text('target_type').notNull(),
		/** Logical references (cross-module, no FK). */
		salesInvoiceId: uuid('sales_invoice_id'),
		supplierBillId: uuid('supplier_bill_id'),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('payment_allocations_uq').on(
			table.paymentId,
			table.targetType,
			table.salesInvoiceId,
			table.supplierBillId,
		),
		index('payment_allocations_payment_id_idx').on(table.paymentId),
		index('payment_allocations_sales_invoice_id_idx').on(table.salesInvoiceId),
		index('payment_allocations_supplier_bill_id_idx').on(table.supplierBillId),
		check('payment_allocations_target_check', sql`target_type IN ('sales_invoice', 'supplier_bill')`),
		check(
			'payment_allocations_target_present_check',
			sql`(target_type = 'sales_invoice' AND sales_invoice_id IS NOT NULL) OR (target_type = 'supplier_bill' AND supplier_bill_id IS NOT NULL)`,
		),
		check('payment_allocations_amount_check', sql`amount > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * payment.gateway_payments — online checkouts of invoices (ERP-0020)
 * ------------------------------------------------------------------------ */

/**
 * `payment.gateway_payments` — online checkouts of invoices (ERP-0020).
 *
 * @remarks
 * `pending -> paid | expired | failed`. A paid webhook on an expired or failed
 * row still counts: money received is a fact. Paid is applied once — the row
 * is locked, a receipt is posted against the invoice and `receipt_id` set; a
 * replay finds `receipt_id` and does nothing.
 */
export const gatewayPayments = paymentSchema.table(
	'gateway_payments',
	{
		/** Also the merchant reference sent to the provider. */
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; nullable per ADR-0014. */
		organizationId: text('organization_id'),
		/** Logical reference to sales.invoices.id (ADR-0014: no cross-module FK). */
		salesInvoiceId: uuid('sales_invoice_id'),
		provider: text('provider').$type<TGatewayProvider>().notNull(),
		providerReference: varchar('provider_reference', { length: 100 }),
		paymentUrl: text('payment_url'),
		/** IDR minor units, the outstanding rounded up to whole rupiah. */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		status: text('status').$type<TGatewayPaymentStatus>().notNull().default('pending'),
		expiresAt: unixTimestampNullable('expires_at'),
		paidAt: unixTimestampNullable('paid_at'),
		paidAmount: bigint('paid_amount', { mode: 'number' }),
		paymentChannel: text('payment_channel'),
		providerTransactionId: varchar('provider_transaction_id', { length: 100 }),
		/** Logical reference to sales.receipts.id (ADR-0014: no cross-module FK). */
		receiptId: uuid('receipt_id'),
		settlementNote: text('settlement_note'),
		lastEvent: jsonb('last_event'),
		/** Logical reference to auth.users.id. */
		requestedBy: text('requested_by'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('gateway_payments_sales_invoice_id_idx').on(table.salesInvoiceId),
		index('gateway_payments_status_idx').on(table.status),
		uniqueIndex('gateway_payments_provider_reference_uq')
			.on(table.provider, table.providerReference)
			.where(sql`provider_reference IS NOT NULL`),
		uniqueIndex('gateway_payments_receipt_id_uq')
			.on(table.receiptId)
			.where(sql`receipt_id IS NOT NULL`),
		check('gateway_payments_provider_check', sql`provider IN ('xendit', 'singapay', 'fake')`),
		check('gateway_payments_status_check', sql`status IN ('pending', 'paid', 'expired', 'failed')`),
		check('gateway_payments_amount_check', sql`amount > 0`),
		check('gateway_payments_paid_amount_check', sql`paid_amount IS NULL OR paid_amount >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * Relational v2 (ADR-0004): in-schema only — allocations belong to a payment
 * ------------------------------------------------------------------------ */

export const paymentRelations = defineRelationsPart({ payments, paymentAllocations }, (r) => ({
	payments: {
		allocations: r.many.paymentAllocations({
			from: r.payments.id,
			to: r.paymentAllocations.paymentId,
		}),
	},
	paymentAllocations: {
		payment: r.one.payments({
			from: r.paymentAllocations.paymentId,
			to: r.payments.id,
		}),
	},
}));

export type TPaymentInsert = typeof payments.$inferInsert;
export type TPaymentSelect = typeof payments.$inferSelect;
export type TPaymentInsertInput = Omit<TPaymentInsert, 'createdAt' | 'updatedAt'> &
	Partial<Pick<TPaymentInsert, 'createdAt' | 'updatedAt'>>;
export type TPaymentAllocationInsert = typeof paymentAllocations.$inferInsert;
export type TPaymentAllocationSelect = typeof paymentAllocations.$inferSelect;
export type TGatewayPaymentInsert = typeof gatewayPayments.$inferInsert;
export type TGatewayPaymentSelect = typeof gatewayPayments.$inferSelect;
