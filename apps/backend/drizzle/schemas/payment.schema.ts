/**
 * Payment module schema — owns the `payment` Postgres schema.
 *
 * @remarks
 * All money movement of the ERP: the single payment ledger with its allocations
 * to any payable, plus the provider gateways. ADR-0024 Q18:
 * `payment.gateway_payments` merged into `payment.payments` (`channel`,
 * `gateway_id` + the provider columns) and the direct
 * `sales_invoice_id` / `supplier_bill_id` / `employee_advance_id` columns are
 * gone because `payment_allocations` carries every payable through a polymorph
 * `payable_type` / `payable_id` pair.
 *
 * Secrets are AES-256-GCM ciphertext with the key from `PAYMENT_SECRET_KEY`;
 * no read endpoint ever returns ciphertext or plaintext.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgSchema,
	smallint,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const paymentSchema = pgSchema('payment');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

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

export const PAYMENT_DIRECTIONS = ['in', 'out'] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

/** `manual` = recorded by staff; `gateway` = an online checkout. */
export const PAYMENT_CHANNELS = ['manual', 'gateway'] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/** Ledger statuses plus the gateway checkout states, mapped explicitly. */
export const PAYMENT_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'executed',
	'pending',
	'paid',
	'expired',
	'failed',
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

export const GATEWAY_PROVIDERS = ['xendit', 'singapay', 'fake'] as const;
export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_MODES = ['sandbox', 'live'] as const;
export type GatewayMode = (typeof GATEWAY_MODES)[number];

/** What an allocation settles (ADR-0024 Q18 polymorph vocabulary). */
export const PAYABLE_TYPES = [
	'sale_invoice',
	'supplier_bill',
	'employee_advance',
	'expense_claim',
	'expense_settlement',
	'employee_salary_record',
] as const;
export type PayableType = (typeof PAYABLE_TYPES)[number];

const organizationId = () => text('organization_id');

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * payment.gateways
 * ------------------------------------------------------------------------ */

/**
 * Provider configuration of a payment gateway.
 *
 * @remarks
 * Secrets are write-only: the API never returns `secret_ciphertext` or the
 * plaintext. `secret_last4` exists only so staff can recognise which secret is
 * loaded.
 */
export const gateways = paymentSchema.table(
	'gateways',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id — cross-module FK omitted. */
		organizationId: text('organization_id'),
		provider: text('provider').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		mode: text('mode').notNull().default('sandbox'),
		config: jsonb('config').$type<Record<string, unknown>>(),
		secretCiphertext: text('secret_ciphertext'),
		secretIv: text('secret_iv'),
		secretTag: text('secret_tag'),
		secretLast4: varchar('secret_last4', { length: 4 }),
		keyVersion: smallint('key_version').notNull().default(1),
		webhookTokenCiphertext: text('webhook_token_ciphertext'),
		webhookTokenIv: text('webhook_token_iv'),
		webhookTokenTag: text('webhook_token_tag'),
		isActive: boolean('is_active').notNull().default(true),
		isDefault: boolean('is_default').notNull().default(false),
		rotatedAt: unixTimestampNullable('rotated_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('gateways_org_provider_code_uq').on(
			table.organizationId,
			table.provider,
			table.code,
		),
		index('gateways_provider_idx').on(table.provider),
		check(
			'gateways_provider_check',
			sql`provider IN ('xendit', 'singapay', 'fake')`,
		),
		check('gateways_mode_check', sql`mode IN ('sandbox', 'live')`),
		check('gateways_key_version_check', sql`key_version > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * payment.payments — THE single payment ledger
 * ------------------------------------------------------------------------ */

/**
 * THE single payment ledger, receipts and disbursements both.
 *
 * @remarks
 * Merged with `payment.gateway_payments` (ADR-0024 Q18). A payment settles
 * payables through `payment_allocations`, so the direct invoice/bill/advance
 * columns are gone. Execution requires approval and is not allowed by the
 * requester. A paid webhook on an expired or failed gateway row still counts:
 * money received is a fact; paid is applied once, and a replayed webhook finds
 * `receipt_id` and does nothing.
 */
export const payments = paymentSchema.table(
	'payments',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		paymentType: text('payment_type').notNull(),
		direction: text('direction').notNull(),
		channel: text('channel').notNull().default('manual'),
		gatewayId: uuid('gateway_id').references(() => gateways.id, {
			onDelete: 'set null',
		}),
		provider: text('provider'),
		providerReference: varchar('provider_reference', { length: 100 }),
		paymentUrl: text('payment_url'),
		expiresAt: unixTimestampNullable('expires_at'),
		paidAt: unixTimestampNullable('paid_at'),
		paidAmount: bigint('paid_amount', { mode: 'number' }),
		paymentChannel: text('payment_channel'),
		providerTransactionId: varchar('provider_transaction_id', { length: 100 }),
		/** Logical reference to sale.receipts.id — cross-module FK omitted. */
		receiptId: uuid('receipt_id'),
		settlementNote: text('settlement_note'),
		lastEvent: jsonb('last_event').$type<Record<string, unknown>>(),
		counterpartyType: text('counterparty_type'),
		counterpartyId: text('counterparty_id'),
		amount: bigint('amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		paymentMethod: text('payment_method').notNull().default('bank_transfer'),
		paymentDate: date('payment_date'),
		status: text('status').notNull().default('draft'),
		/** Logical references to auth.users.id — cross-module FK omitted. */
		requestedBy: text('requested_by'),
		requestedAt: unixTimestampNullable('requested_at'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		executedBy: text('executed_by'),
		executedAt: unixTimestampNullable('executed_at'),
		/** Logical reference to finance.cash_bank_accounts.id — FK omitted. */
		cashBankAccountId: uuid('cash_bank_account_id'),
		referenceNumber: text('reference_number'),
		notes: text('notes'),
		voidedAt: unixTimestampNullable('voided_at'),
		voidReason: text('void_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('payments_org_code_uq').on(table.organizationId, table.code),
		index('payments_status_idx').on(table.status),
		index('payments_counterparty_idx').on(
			table.organizationId,
			table.counterpartyType,
			table.counterpartyId,
		),
		index('payments_cash_bank_account_id_idx').on(table.cashBankAccountId),
		uniqueIndex('payments_provider_reference_uq')
			.on(table.provider, table.providerReference)
			.where(sql`provider_reference IS NOT NULL`),
		uniqueIndex('payments_receipt_id_uq')
			.on(table.receiptId)
			.where(sql`receipt_id IS NOT NULL`),
		check(
			'payments_type_check',
			sql`payment_type IN ('receipt', 'disbursement', 'refund', 'advance_disbursement', 'payroll', 'profit_distribution', 'investment')`,
		),
		check('payments_direction_check', sql`direction IN ('in', 'out')`),
		check('payments_channel_check', sql`channel IN ('manual', 'gateway')`),
		check(
			'payments_provider_check',
			sql`provider IS NULL OR provider IN ('xendit', 'singapay', 'fake')`,
		),
		check(
			'payments_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'executed', 'pending', 'paid', 'expired', 'failed', 'reversed', 'void', 'cancelled')`,
		),
		check('payments_amount_check', sql`amount > 0`),
		check(
			'payments_paid_amount_check',
			sql`paid_amount IS NULL OR paid_amount >= 0`,
		),
		check(
			'payments_method_check',
			sql`payment_method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque', 'offset')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * payment.payment_allocations
 * ------------------------------------------------------------------------ */

/**
 * Allocation of one payment to one payable document (ADR-0024 Q18).
 *
 * @remarks
 * One payment may settle several payables and one payable may receive several
 * payments (staged settlement). `payable_id` is text because the targets mix id
 * types; the owning service resolves it through a resolver map of exported
 * services.
 */
export const paymentAllocations = paymentSchema.table(
	'payment_allocations',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		paymentId: uuid('payment_id')
			.notNull()
			.references(() => payments.id, { onDelete: 'cascade' }),
		payableType: text('payable_type').notNull(),
		payableId: text('payable_id').notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		allocatedAt: unixTimestamp('allocated_at').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('payment_allocations_uq').on(
			table.paymentId,
			table.payableType,
			table.payableId,
		),
		index('payment_allocations_payable_idx').on(
			table.payableType,
			table.payableId,
		),
		check(
			'payment_allocations_payable_type_check',
			sql`payable_type IN ('sale_invoice', 'supplier_bill', 'employee_advance', 'expense_claim', 'expense_settlement', 'employee_salary_record')`,
		),
		check('payment_allocations_amount_check', sql`amount > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * payment.settings / payment.code_numberings
 * ------------------------------------------------------------------------ */

export const paymentSettings = paymentSchema.table(
	'settings',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		description: text('description'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('payment_settings_scope_uq').on(
			table.organizationId,
			table.settingGroup,
			table.settingKey,
		),
	],
);

export const paymentCodeNumberings = createCodeNumberingTable(paymentSchema);

export type TGatewaySelect = typeof gateways.$inferSelect;
export type TGatewayInsert = typeof gateways.$inferInsert;
export type TPaymentSelect = typeof payments.$inferSelect;
export type TPaymentInsert = typeof payments.$inferInsert;
export type TPaymentAllocationSelect = typeof paymentAllocations.$inferSelect;
export type TPaymentAllocationInsert = typeof paymentAllocations.$inferInsert;
export type TPaymentSettingSelect = typeof paymentSettings.$inferSelect;
export type TPaymentSettingInsert = typeof paymentSettings.$inferInsert;
export type TPaymentCodeNumberingSelect =
	typeof paymentCodeNumberings.$inferSelect;
export type TPaymentCodeNumberingInsert =
	typeof paymentCodeNumberings.$inferInsert;
