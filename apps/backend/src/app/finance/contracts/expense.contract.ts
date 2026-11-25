import { z } from 'zod';
import { EXPENSE_CLAIM_STATUSES } from '@drizzle/schemas/finance.schema';
import { isoDate, minorAmount } from './ledger.contract';

/**
 * Employee expense claim (ERP-0013).
 *
 * @remarks
 * `categoryCode` is a `chart_of_accounts.code` of an active expense account;
 * the approve step resolves each code to a postable account. `totalAmount` is
 * never taken from the client — the service derives it from the lines.
 */
export const expenseClaimItemInputSchema = z.object({
	expenseDate: isoDate.nullish().transform((v) => v ?? null),
	categoryCode: z.string().trim().min(1).max(32),
	description: z.string().trim().max(500).nullish().transform((v) => v ?? null),
	amount: minorAmount,
	taxAmount: minorAmount.default(0),
});

export const expenseClaimCreateSchema = z.object({
	employeeId: z.string().uuid(),
	projectId: z.uuid().nullish().transform((v) => v ?? null),
	claimDate: isoDate,
	notes: z.string().trim().max(2000).nullish().transform((v) => v ?? null),
	items: z.array(expenseClaimItemInputSchema).min(1).max(200),
});

export const expenseClaimUpdateSchema = z
	.object({
		employeeId: z.string().uuid().optional(),
		projectId: z.uuid().nullable().optional(),
		claimDate: isoDate.optional(),
		notes: z.string().trim().max(2000).nullable().optional(),
		items: z.array(expenseClaimItemInputSchema).min(1).max(200).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const EXPENSE_CLAIM_SORT_FIELDS = [
	'code',
	'claimDate',
	'totalAmount',
	'createdAt',
] as const;

export const expenseClaimListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z.enum(EXPENSE_CLAIM_STATUSES).optional(),
	employeeId: z.string().uuid().optional(),
	/** Inclusive `claim_date` range. */
	from: isoDate.optional(),
	to: isoDate.optional(),
	/** Claim code. Employee names live in another module, so they are not searched here. */
	search: z.string().trim().max(100).optional(),
	sortBy: z.enum(EXPENSE_CLAIM_SORT_FIELDS).default('claimDate'),
	sortDir: z.enum(['asc', 'desc']).default('desc'),
});
