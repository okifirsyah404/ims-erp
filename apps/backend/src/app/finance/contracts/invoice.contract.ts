import { z } from 'zod';
import {
	INVOICE_STATUSES,
	INVOICE_TERM_KINDS,
	RECEIPT_METHODS,
	RECEIPT_STATUSES,
} from '@drizzle/schemas/finance.schema';

/**
 * Request schemas for invoices and receipts (`/invoices`, `/receipts`,
 * ADR-0011 step 3d-2). Money is integer IDR minor units; business dates are
 * Jakarta `YYYY-MM-DD` strings.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const money = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const businessDate = z.iso.date();
const page = {
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
};

/** How much of the order this term bills (free terms). */
export const termSchema = z.discriminatedUnion('mode', [
	/** Share of the order tax base, in basis points (3000 = 30%). */
	z.object({ mode: z.literal('percentage'), bps: z.number().int().min(1).max(10_000) }),
	/** VAT-inclusive amount. */
	z.object({ mode: z.literal('amount'), total: money }),
	/** Everything not yet invoiced. */
	z.object({ mode: z.literal('remaining') }),
	/** The next term of the order's planned schedule, chosen by the server. */
	z.object({ mode: z.literal('next') }),
]);

export const createInvoiceSchema = z.object({
	salesOrderId: z.uuid(),
	term: termSchema,
	/** Defaults to the planned term's label, or DP / Termin / Pelunasan. */
	description: optionalText(200),
	dueDate: businessDate.nullish(),
	notes: optionalText(4000),
});

export const issueInvoiceSchema = z
	.object({
		/** Defaults to today (Jakarta). */
		issueDate: businessDate.nullish(),
		dueDate: businessDate.nullish(),
	})
	.refine((body) => !body.issueDate || !body.dueDate || body.dueDate >= body.issueDate, {
		message: 'The due date cannot be before the issue date',
		path: ['dueDate'],
	});

export const reasonSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const createReceiptSchema = z.object({
	amount: money,
	/** Defaults to today (Jakarta). */
	receivedDate: businessDate.nullish(),
	method: z.enum(RECEIPT_METHODS),
	reference: optionalText(100),
	notes: optionalText(2000),
});

export const invoiceListQuerySchema = z.object({
	...page,
	status: z.enum(INVOICE_STATUSES).optional(),
	termKind: z.enum(INVOICE_TERM_KINDS).optional(),
	salesOrderId: z.uuid().optional(),
	/** Issued and unpaid with a due date before today. */
	overdue: z.coerce.boolean().optional(),
});

export const receiptListQuerySchema = z.object({
	...page,
	status: z.enum(RECEIPT_STATUSES).optional(),
});

export const idParamSchema = z.object({ id: z.uuid() });
export const orderParamSchema = z.object({ orderId: z.uuid() });

export type TTermRequestBody = z.output<typeof termSchema>;
export type TCreateInvoiceRequest = z.output<typeof createInvoiceSchema>;
export type TIssueInvoiceRequest = z.output<typeof issueInvoiceSchema>;
export type TCreateReceiptRequest = z.output<typeof createReceiptSchema>;
export type TInvoiceListQuery = z.output<typeof invoiceListQuerySchema>;
export type TReceiptListQuery = z.output<typeof receiptListQuerySchema>;
