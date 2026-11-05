import { z } from 'zod';
import { quantityToMilli } from '@ims-erp/common';
import { ITEM_UNITS } from '@drizzle/schemas/inventory.schema';
import { QUOTATION_LOST_REASONS, QUOTATION_STATUSES } from '@drizzle/schemas/sales.schema';

/**
 * Request schemas for the quotation (SPH) endpoints (`/sales/quotations`,
 * ADR-0011 step 3c).
 *
 * @remarks
 * Money is integer IDR minor units (ADR-0002); quantities carry at most three
 * decimals; business dates are Jakarta `YYYY-MM-DD` strings.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const businessDate = z.iso.date();

/** Quantity as number or decimal string; normalised to a string. */
const quantity = z
	.union([z.number(), z.string().trim()])
	.transform(String)
	.refine((value) => {
		try {
			const milli = quantityToMilli(value);
			return milli > 0n && milli <= 1_000_000_000n;
		} catch {
			return false;
		}
	}, 'Quantity must be above 0 with at most three decimals');

/**
 * One line: an inventory item (`itemId`; name, unit and price default to the
 * item's) or a custom line (name, unit and unitPrice required).
 */
export const quotationLineSchema = z
	.object({
		itemId: z.uuid().nullish(),
		name: optionalText(300),
		specification: optionalText(4000),
		unit: z.enum(ITEM_UNITS).nullish(),
		quantity,
		unitPrice: money.nullish(),
		discountAmount: money.default(0),
	})
	.refine((line) => !!line.itemId || (!!line.name && !!line.unit && line.unitPrice != null), {
		message: 'A custom line needs a name, a unit and a unit price',
	});

/**
 * Planned billing schedule: 1–6 terms whose shares (basis points) add up to
 * exactly 10000, e.g. DP 30% / Siap Kirim 40% / Terpasang 30%.
 */
export const paymentScheduleSchema = z
	.array(
		z.object({
			label: z.string().trim().min(1).max(60),
			percentBps: z.number().int().min(1).max(10_000),
		}),
	)
	.min(1)
	.max(6)
	.refine((items) => items.reduce((sum, item) => sum + item.percentBps, 0) === 10_000, {
		message: 'Payment schedule shares must add up to 100%',
	});

export const quotationBodySchema = z
	.object({
		customerId: z.uuid(),
		customerContactId: z.uuid().nullish(),
		leadId: z.uuid().nullish(),
		title: z.string().trim().min(1).max(200),
		/** Attention person ("Up"); defaults to the chosen contact's name. */
		attention: optionalText(200),
		/** e.g. "DP 50% - 50% BAST"; defaults to the schedule's description. */
		paymentTerms: optionalText(300),
		paymentSchedule: paymentScheduleSchema.nullish(),
		guarantee: optionalText(300),
		/** Defaults to today (Jakarta). */
		quotationDate: businessDate.nullish(),
		validUntil: businessDate.nullish(),
		vatEnabled: z.boolean().default(true),
		/** Basis points (1100 = 11%); defaults to the standard rate. */
		vatRateBps: z.number().int().min(0).max(10_000).nullish(),
		notes: optionalText(4000),
		terms: optionalText(8000),
		lines: z.array(quotationLineSchema).min(1).max(200),
	})
	.refine((body) => !body.validUntil || !body.quotationDate || body.validUntil >= body.quotationDate, {
		message: 'Valid until cannot be before the quotation date',
		path: ['validUntil'],
	});

export const quotationDecisionSchema = z
	.object({
		decision: z.enum(['approve', 'reject']),
		reason: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.decision === 'approve' || (value.reason?.length ?? 0) > 0, {
		message: 'A reason is required when rejecting',
		path: ['reason'],
	});

/** "Batal": the customer did not proceed; `other` needs a note. */
export const quotationLostSchema = z
	.object({
		reason: z.enum(QUOTATION_LOST_REASONS),
		note: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.reason !== 'other' || (value.note?.length ?? 0) > 0, {
		message: 'A note is required for reason "other"',
		path: ['note'],
	});

export const quotationListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(QUOTATION_STATUSES).optional(),
	customerId: z.uuid().optional(),
});

export const quotationIdParamSchema = z.object({ id: z.uuid() });

export type TQuotationLineRequest = z.output<typeof quotationLineSchema>;
export type TQuotationBodyRequest = z.output<typeof quotationBodySchema>;
export type TQuotationDecisionRequest = z.output<typeof quotationDecisionSchema>;
export type TQuotationListQuery = z.output<typeof quotationListQuerySchema>;
export type TQuotationLostRequest = z.output<typeof quotationLostSchema>;
