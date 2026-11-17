/**
 * Payment domain schema — owns the `payment` Postgres schema.
 *
 * Online checkout of a sales invoice through a provider-neutral gateway
 * (ERP-0020, ADR-0021, moved out of `sales` by ADR-0023). This module owns the
 * checkout row and its verified webhook state only: the receipt (kwitansi) it
 * produces stays `sales.receipts`, and the single payment ledger stays
 * `finance.payments`.
 *
 * House rules honoured here:
 * - Every cross-module reference is a plain nullable id column with no FK,
 *   validated through the owning module's contract before the write
 *   (ADR-0014): `sales_invoice_id` -> sales.invoices, `receipt_id` ->
 *   sales.receipts, `organization_id` -> auth.organizations,
 *   `requested_by` -> auth.users.
 * - Money is bigint IDR minor units (ADR-0002); operational timestamps are
 *   unix ms.
 * - Soft delete only (`deleted_at`), never a hard delete.
 */
import { sql } from 'drizzle-orm';
import { bigint, check, index, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const paymentSchema = pgSchema('payment');

export const GATEWAY_PROVIDERS = ['xendit', 'singapay', 'fake'] as const;
export type TGatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_PAYMENT_STATUSES = ['pending', 'paid', 'expired', 'failed'] as const;
export type TGatewayPaymentStatus = (typeof GATEWAY_PAYMENT_STATUSES)[number];

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

export type TGatewayPaymentInsert = typeof gatewayPayments.$inferInsert;
export type TGatewayPaymentSelect = typeof gatewayPayments.$inferSelect;
