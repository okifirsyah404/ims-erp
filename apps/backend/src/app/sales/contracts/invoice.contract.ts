import { z } from 'zod';
import { isoDate, minorAmount } from '@app/accounting/contracts/ledger.contract';
import { ledgerIdParamSchema } from '@app/accounting/contracts/ledger.contract';

/* ----------------------------- invoices (F4) ----------------------------- */

export const invoiceItemSchema = z.object({
	itemId: z.string().uuid().nullish().transform((v) => v ?? null),
	description: z.string().nullish().transform((v) => v ?? null),
	quantity: z.number().nonnegative().max(1_000_000),
	unitPrice: minorAmount,
	discountAmount: minorAmount.default(0),
	taxAmount: minorAmount.default(0),
});

export const invoiceCreateSchema = z.object({
	invoiceType: z.enum(['sales', 'proforma', 'recurring']).default('sales'),
	customerId: z.string().uuid().nullish().transform((v) => v ?? null),
	salesOrderId: z.string().uuid().nullish().transform((v) => v ?? null),
	paymentTermId: z.string().uuid().nullish().transform((v) => v ?? null),
	issueDate: isoDate.nullish().transform((v) => v ?? null),
	dueDate: isoDate.nullish().transform((v) => v ?? null),
	currencyCode: z.string().length(3).default('IDR'),
	notes: z.string().nullish().transform((v) => v ?? null),
	items: z.array(invoiceItemSchema).min(1).max(500),
});

export const invoiceUpdateSchema = z
	.object({
		customerId: z.string().uuid().nullable().optional(),
		paymentTermId: z.string().uuid().nullable().optional(),
		issueDate: isoDate.nullable().optional(),
		dueDate: isoDate.nullable().optional(),
		notes: z.string().nullable().optional(),
		items: z.array(invoiceItemSchema).min(1).max(500).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const invoiceListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z
		.enum([
			'draft',
			'issued',
			'partially_paid',
			'paid',
			'overdue',
			'void',
			'cancelled',
		])
		.optional(),
	customerId: z.string().uuid().optional(),
});

export { ledgerIdParamSchema as invoiceIdParamSchema };
