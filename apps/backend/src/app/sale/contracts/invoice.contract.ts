import { z } from 'zod';
import { isoDate, minorAmount } from '@app/finance/contracts/ledger.contract';
import { ledgerIdParamSchema } from '@app/finance/contracts/ledger.contract';
import { RECEIPT_METHODS, RECEIPT_STATUSES } from '@drizzle/schemas/sale.schema';

/* ----------------------------- invoices (F4) ----------------------------- */

export const invoiceItemSchema = z
	.object({
		productId: z.string().uuid().nullish().transform((v) => v ?? null),
		description: z.string().nullish().transform((v) => v ?? null),
		quantity: z.number().nonnegative().max(1_000_000),
		unitPrice: minorAmount,
		discountAmount: minorAmount.default(0),
		taxAmount: minorAmount.default(0),
		/** Service period of a maintenance/subscription line: revenue is deferred (ERP-0135). */
		servicePeriodStart: isoDate.nullish().transform((v) => v ?? null),
		servicePeriodEnd: isoDate.nullish().transform((v) => v ?? null),
	})
	.refine((item) => (item.servicePeriodStart === null) === (item.servicePeriodEnd === null), {
		message: 'A service period needs both a start and an end date',
		path: ['servicePeriodEnd'],
	})
	.refine((item) => !item.servicePeriodStart || !item.servicePeriodEnd || item.servicePeriodEnd >= item.servicePeriodStart, {
		message: 'The service period cannot end before it starts',
		path: ['servicePeriodEnd'],
	});

export const invoiceCreateSchema = z.object({
	invoiceType: z.enum(['sales', 'proforma', 'recurring']).default('sales'),
	customerId: z.string().uuid().nullish().transform((v) => v ?? null),
	orderId: z.string().uuid().nullish().transform((v) => v ?? null),
	paymentTermId: z.string().uuid().nullish().transform((v) => v ?? null),
	issueDate: isoDate.nullish().transform((v) => v ?? null),
	dueDate: isoDate.nullish().transform((v) => v ?? null),
	currencyCode: z.string().length(3).default('IDR'),
	notes: z.string().nullish().transform((v) => v ?? null),
	/** B-42: the invoice's heading (a free invoice has no order title). */
	title: z.string().trim().max(200).nullish().transform((v) => (v ? v : null)),
	/**
	 * B-42: when sent, the server computes every line's VAT from the rate
	 * (`false` = no VAT); absent keeps the lines' own tax amounts (legacy API).
	 */
	vatEnabled: z.boolean().optional(),
	/** Basis points (1100 = 11%); defaults to the standard rate. */
	vatRateBps: z.number().int().min(0).max(10_000).nullish().transform((v) => v ?? null),
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

/**
 * One billing term of a sales order (M02 web billing card, ADR-0011 step
 * 3d-2): the next planned term, a percentage of the order's tax base, an
 * amount incl. VAT, or whatever is left.
 */
export const termInputSchema = z.discriminatedUnion('mode', [
	z.object({ mode: z.literal('next') }),
	z.object({ mode: z.literal('percentage'), bps: z.number().int().min(1).max(10_000) }),
	z.object({ mode: z.literal('amount'), total: minorAmount.refine((value) => value > 0) }),
	z.object({ mode: z.literal('remaining') }),
]);

/** `POST /invoices` from the web: a draft for one term of an order. */
export const invoiceTermCreateSchema = z.object({
	orderId: z.string().uuid(),
	term: termInputSchema,
	description: z.string().trim().max(200).nullish().transform((v) => (v ? v : null)),
	dueDate: isoDate.nullish().transform((v) => v ?? null),
	notes: z.string().trim().max(2000).nullish().transform((v) => (v ? v : null)),
});

/** `POST /invoices/:id/issue`: the dates the issuer confirms (both optional). */
export const invoiceIssueSchema = z
	.object({
		issueDate: isoDate.nullish().transform((v) => v ?? null),
		dueDate: isoDate.nullish().transform((v) => v ?? null),
	})
	.default({ issueDate: null, dueDate: null });

export const salesOrderIdParamSchema = z.object({ orderId: z.string().uuid() });

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
	/** The web's down-payment list (`termKind=down_payment`). */
	termKind: z.enum(['down_payment', 'installment', 'settlement']).optional(),
	/** Code, title, order code or customer name. */
	search: z.string().trim().max(100).optional(),
	/** Issued or partly paid with a due date before today (Jakarta). */
	overdue: z
		.enum(['true', 'false'])
		.optional()
		.transform((v) => v === 'true'),
});

export type TInvoiceTermCreateInput = z.output<typeof invoiceTermCreateSchema>;
export type TInvoiceIssueInput = z.output<typeof invoiceIssueSchema>;

/**
 * Page settings and filters of `GET /sales/invoices`.
 *
 * @remarks
 * `overdue` is a client-facing boolean the service turns into the
 * repository's `overdueOn` business date; the repository never sees it.
 */
export type TInvoiceListRequest = z.output<typeof invoiceListQuerySchema> & {
	organizationId: string;
};

/**
 * Window for the dashboard's invoiced-sales aggregate (M01).
 *
 * @remarks
 * Business dates (Asia/Jakarta `YYYY-MM-DD`), inclusive. Buckets are keyed on
 * `issue_date`; `draft`, `void` and `cancelled` invoices never count as
 * invoiced.
 */
export const invoiceSummaryQuerySchema = z
	.object({
		from: isoDate,
		to: isoDate,
		groupBy: z.enum(['month', 'day']).default('month'),
	})
	.refine((query) => query.from <= query.to, {
		message: 'from must not be after to',
	});

export type TInvoiceSummaryQuery = z.output<typeof invoiceSummaryQuerySchema>;

export { ledgerIdParamSchema as invoiceIdParamSchema };

/* ----------------------------- receipts (AR) ----------------------------- */

export const reasonSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export const createReceiptSchema = z.object({
	amount: minorAmount,
	/** Defaults to today (Jakarta). */
	receivedDate: isoDate.nullish(),
	method: z.enum(RECEIPT_METHODS),
	reference: z.string().trim().max(100).nullish().transform((v) => v ?? null),
	notes: z.string().trim().max(2000).nullish().transform((v) => v ?? null),
});

export const receiptListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z.enum(RECEIPT_STATUSES).optional(),
	/** Free-text over receipt code, reference, invoice code and customer. */
	search: z.string().trim().max(100).optional(),
});

export type TCreateReceiptInput = z.output<typeof createReceiptSchema>;
export type TReceiptListQuery = z.output<typeof receiptListQuerySchema>;
