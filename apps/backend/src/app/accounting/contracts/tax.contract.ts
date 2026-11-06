import { z } from 'zod';
import {
	TAX_BASE_TYPES,
	TAX_TYPE_KINDS,
} from '@drizzle/schemas/accounting.schema';

/** Shared `:id` param. */
export const taxIdParamSchema = z.object({ id: z.string().uuid() });

/** `numeric(9,4)` percentage, e.g. `11` or `2.5`. */
const rateSchema = z
	.string()
	.regex(/^\d{1,5}(\.\d{1,4})?$/, 'Rate must be a percentage with up to 4 decimals');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const minorAmount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const taxTypeCreateSchema = z
	.object({
		code: z.string().min(1).max(32),
		name: z.string().min(1),
		taxType: z.enum(TAX_TYPE_KINDS),
		rate: rateSchema,
		baseType: z.enum(TAX_BASE_TYPES).default('gross'),
		isInclusive: z.boolean().default(false),
		effectiveFrom: isoDate,
		effectiveTo: isoDate.nullish().transform((value) => value ?? null),
		isActive: z.boolean().default(true),
	})
	.refine((data) => !data.effectiveTo || data.effectiveTo >= data.effectiveFrom, {
		message: 'effectiveTo must not be before effectiveFrom',
	});

export const taxTypeUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		isActive: z.boolean().optional(),
		effectiveTo: isoDate.nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const taxTypeListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
});

export const taxRecordListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	year: z.coerce.number().int().min(2000).max(2100).optional(),
	month: z.coerce.number().int().min(1).max(12).optional(),
});

export const taxRecordCreateSchema = z.object({
	taxTypeId: z.string().uuid(),
	periodYear: z.coerce.number().int().min(2000).max(2100),
	periodMonth: z.coerce.number().int().min(1).max(12),
	taxableBase: minorAmount,
	taxAmount: minorAmount.optional(),
	rateDate: isoDate.optional(),
	notes: z.string().nullish(),
});

export const taxRecordUpdateSchema = z
	.object({
		taxableBase: minorAmount.optional(),
		taxAmount: minorAmount.optional(),
		notes: z.string().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const taxRecordTransitionSchema = z.object({
	to: z.enum(['verified', 'filed']),
	filedOn: isoDate.nullish().transform((value) => value ?? null),
});

export const taxCorrectionCreateSchema = z.object({
	/** Signed IDR minor units. Zero is not a correction. */
	amount: z
		.number()
		.int()
		.refine((value) => value !== 0, 'Amount must not be zero')
		.refine((value) => Number.isSafeInteger(value)),
	reason: z.string().trim().min(1),
	evidenceDocumentId: z.string().uuid().nullish().transform((value) => value ?? null),
});

export const recapQuerySchema = z.object({
	year: z.coerce.number().int().min(2000).max(2100),
	month: z.coerce.number().int().min(1).max(12),
});

/** Body of `POST /tax/records/preview`. Nothing is persisted. */
export const taxPreviewSchema = z.object({
	taxTypeId: z.string().uuid(),
	taxableBase: minorAmount,
	date: isoDate,
});

export const withholdingCreateSchema = z.object({
	code: z.string().min(1).max(32),
	taxTypeId: z.string().uuid(),
	counterpartyType: z.string().min(1).nullish().transform((value) => value ?? null),
	counterpartyId: z.string().min(1).nullish().transform((value) => value ?? null),
	baseAmount: minorAmount,
	taxAmount: minorAmount,
	transactionDate: isoDate.nullish().transform((value) => value ?? null),
	periodYear: z.coerce.number().int().min(2000).max(2100).nullish().transform((value) => value ?? null),
	periodMonth: z.coerce.number().int().min(1).max(12).nullish().transform((value) => value ?? null),
});

export const withholdingTransitionSchema = z.object({
	to: z.enum(['verified', 'paid', 'reversed']),
});

/** Edits are allowed only while the row is `recorded`; checked in the service. */
export const withholdingPatchSchema = z
	.object({
		counterpartyType: z.string().min(1).nullable().optional(),
		counterpartyId: z.string().min(1).nullable().optional(),
		baseAmount: minorAmount.optional(),
		taxAmount: minorAmount.optional(),
		transactionDate: isoDate.nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const withholdingListQuerySchema = taxTypeListQuerySchema;
