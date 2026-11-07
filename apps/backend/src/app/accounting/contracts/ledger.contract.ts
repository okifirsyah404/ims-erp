import { z } from 'zod';
import {
	ACCOUNT_TYPES,
	CASH_FLOW_CATEGORIES,
	NORMAL_BALANCES,
} from '@drizzle/schemas/accounting.schema';

/** Shared `:id` param. */
export const ledgerIdParamSchema = z.object({ id: z.string().uuid() });

export const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const minorAmount = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER);

/* ----------------------------- chart of accounts ----------------------------- */

export const accountCreateSchema = z.object({
	code: z.string().min(1).max(32),
	name: z.string().min(1),
	accountType: z.enum(ACCOUNT_TYPES),
	normalBalance: z.enum(NORMAL_BALANCES).default('debit'),
	parentAccountId: z.string().uuid().nullish().transform((v) => v ?? null),
	isPostable: z.boolean().default(true),
	cashFlowCategory: z.enum(CASH_FLOW_CATEGORIES).nullish().transform((v) => v ?? null),
	description: z.string().nullish().transform((v) => v ?? null),
});

export const accountUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		isPostable: z.boolean().optional(),
		isActive: z.boolean().optional(),
		cashFlowCategory: z.enum(CASH_FLOW_CATEGORIES).nullable().optional(),
		description: z.string().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const accountListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(50),
	accountType: z.enum(ACCOUNT_TYPES).optional(),
	isActive: z
		.enum(['true', 'false'])
		.optional()
		.transform((v) => (v === undefined ? undefined : v === 'true')),
});

/* ----------------------------- accounting periods ----------------------------- */

export const periodCreateSchema = z.object({
	periodYear: z.coerce.number().int().min(2000).max(2100),
	periodMonth: z.coerce.number().int().min(1).max(12),
});

export const periodListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(24),
});

export const periodTransitionSchema = z.object({
	to: z.enum(['closed', 'locked', 'open']),
});

/* ----------------------------- journal entries ----------------------------- */

export const journalLineInputSchema = z
	.object({
		accountId: z.string().uuid(),
		debit: minorAmount.default(0),
		credit: minorAmount.default(0),
		description: z.string().nullish().transform((v) => v ?? null),
		costCenterId: z.string().uuid().nullish().transform((v) => v ?? null),
		projectId: z.string().uuid().nullish().transform((v) => v ?? null),
		partyType: z.string().nullish().transform((v) => v ?? null),
		partyId: z.string().nullish().transform((v) => v ?? null),
	})
	.refine((line) => (line.debit > 0) !== (line.credit > 0), {
		message: 'Each line must carry exactly one of debit or credit',
	});

export const journalEntryCreateSchema = z
	.object({
		entryDate: isoDate,
		description: z.string().nullish().transform((v) => v ?? null),
		/** Client-supplied idempotency key (recommended for automated callers). */
		idempotencyKey: z.string().min(1).max(128).nullish().transform((v) => v ?? null),
		lines: z.array(journalLineInputSchema).min(2),
	})
	.refine((data) => data.lines.length >= 2, {
		message: 'A journal entry needs at least two lines',
	});

export const journalEntryListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	year: z.coerce.number().int().min(2000).max(2100).optional(),
	month: z.coerce.number().int().min(1).max(12).optional(),
	status: z
		.enum(['draft', 'submitted', 'approved', 'posted', 'reversed', 'void'])
		.optional(),
});

export const journalReversalCreateSchema = z.object({
	entryDate: isoDate.optional(),
	description: z.string().nullish().transform((v) => v ?? null),
});

/* ----------------------------- opening balances (F3) ----------------------------- */

export const openingBalanceRowSchema = z.object({
	accountId: z.string().uuid(),
	asOfDate: isoDate,
	debitBalance: minorAmount.default(0),
	creditBalance: minorAmount.default(0),
	description: z.string().nullish().transform((v) => v ?? null),
});

export const openingBalanceUpdateSchema = z
	.object({
		debitBalance: minorAmount.optional(),
		creditBalance: minorAmount.optional(),
		description: z.string().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

/* ----------------------------- cash/bank (F3) ----------------------------- */

export const cashBankAccountCreateSchema = z.object({
	code: z.string().min(1).max(32),
	name: z.string().min(1),
	accountType: z.enum(['cash', 'bank', 'ewallet', 'clearing']).default('bank'),
	bankName: z.string().nullish().transform((v) => v ?? null),
	accountNumber: z.string().nullish().transform((v) => v ?? null),
	accountHolder: z.string().nullish().transform((v) => v ?? null),
	/** Informasional (finance plan F3 Q3) — GL tetap dari opening-balance JE. */
	openingBalance: minorAmount.default(0),
	glAccountId: z.string().uuid().nullish().transform((v) => v ?? null),
});

export const cashBankAccountUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		bankName: z.string().nullable().optional(),
		accountNumber: z.string().nullable().optional(),
		accountHolder: z.string().nullable().optional(),
		isActive: z.boolean().optional(),
		glAccountId: z.string().uuid().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const cashBankMovementSchema = z.object({
	cashBankAccountId: z.string().uuid(),
	transactionDate: isoDate,
	direction: z.enum(['in', 'out']),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	description: z.string().nullish().transform((v) => v ?? null),
	referenceNumber: z.string().nullish().transform((v) => v ?? null),
	counterpartAccountId: z.string().uuid(),
});

export const cashBankMovementListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	cashBankAccountId: z.string().uuid().optional(),
});
