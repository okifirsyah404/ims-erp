/**
 * Sales domain schema (scaffold vertical for the authorization layer).
 *
 * Owns the `sales` Postgres schema: quotations and payments. Payments here
 * are the payment-execution state machine used to demonstrate and test the
 * separation-of-duties rules (approve != execute, execute only after
 * approval). A future finance module may take ownership of payments; until
 * then they live in this module and other modules reference them by plain
 * id (no cross-schema FKs, per modular-monolith rule).
 */
import {
	pgSchema,
	text,
	integer,
	index,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { defineRelationsPart } from 'drizzle-orm';
import { unixTimestamp } from '@drizzle/datatypes/unix-timestamp';

export const salesSchema = pgSchema('sales');

/**
 * Quotation document states. Transitions:
 * draft -> submitted -> approved | rejected
 * Only `submitted` quotations are approvable; only `draft` are submittable.
 */
export const QUOTATION_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/**
 * Payment states. Transitions:
 * pending -> approved -> executed
 * Execution is allowed only from `approved` and is enforced transactionally
 * with a conditional UPDATE to prevent races/double execution.
 */
export const PAYMENT_STATUSES = ['pending', 'approved', 'executed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const quotations = salesSchema.table(
	'quotations',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id').notNull(),
		code: text('code').notNull(),
		title: text('title').notNull(),
		/** Exact integer IDR minor units (ADR-0002). Never a float. */
		amount: integer('amount').notNull(),
		status: text('status').notNull().default('draft'),
		createdBy: text('created_by').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('quotations_org_code_uq').on(table.organizationId, table.code),
		index('quotations_org_idx').on(table.organizationId),
	],
);

export const payments = salesSchema.table(
	'payments',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id').notNull(),
		/** Plain id reference (no cross-schema FK): sales.quotations.id */
		quotationId: text('quotation_id').notNull(),
		/** Exact integer IDR minor units (ADR-0002). */
		amount: integer('amount').notNull(),
		status: text('status').notNull().default('pending'),
		createdBy: text('created_by').notNull(),
		/** Audit columns for the executed state. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestamp('approved_at'),
		executedBy: text('executed_by'),
		executedAt: unixTimestamp('executed_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('payments_org_idx').on(table.organizationId),
		index('payments_quotation_idx').on(table.quotationId),
	],
);

export const salesRelations = defineRelationsPart(
	{ quotations, payments },
	(r) => ({
		payments: {
			quotation: r.one.quotations({
				from: r.payments.quotationId,
				to: r.quotations.id,
			}),
		},
		quotations: {
			payments: r.many.payments({
				from: r.quotations.id,
				to: r.payments.quotationId,
			}),
		},
	}),
);

export type TQuotationInsert = typeof quotations.$inferInsert;
export type TQuotationSelect = typeof quotations.$inferSelect;
export type TPaymentInsert = typeof payments.$inferInsert;
export type TPaymentSelect = typeof payments.$inferSelect;
