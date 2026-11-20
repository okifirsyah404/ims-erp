import { z } from 'zod';
import { isoDate, minorAmount } from './ledger.contract';

/* ----------------------------- payments (F4) ----------------------------- */
/* ----------------------------- supplier bills (F5) ----------------------------- */

export const supplierBillCreateSchema = z.object({
	supplierCompanyId: z.string().uuid(),
	purchaseOrderId: z.string().uuid().nullish().transform((v) => v ?? null),
	billDate: isoDate,
	dueDate: isoDate.nullish().transform((v) => v ?? null),
	subtotal: minorAmount,
	taxTotal: minorAmount.default(0),
	currencyCode: z.string().length(3).default('IDR'),
	notes: z.string().nullish().transform((v) => v ?? null),
});

/** A bill made from a purchase order (ERP-0012): only received, unbilled quantities. */
export const supplierBillFromOrderSchema = z.object({
	purchaseOrderId: z.string().uuid(),
	supplierInvoiceNumber: z.string().trim().min(1).max(100),
	billDate: isoDate,
	dueDate: isoDate.nullish().transform((v) => v ?? null),
	lines: z
		.array(
			z.object({
				purchaseOrderItemId: z.string().uuid(),
				quantity: z
					.union([z.number(), z.string().trim()])
					.transform(String)
					.refine((value) => /^\d+(\.\d{1,3})?$/.test(value) && Number(value) > 0, 'Quantity must be above 0 with at most three decimals'),
			}),
		)
		.min(1)
		.max(200),
});

export const supplierBillListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z
		.enum(['draft', 'approved', 'partially_paid', 'paid', 'overdue', 'void'])
		.optional(),
	supplierCompanyId: z.string().uuid().optional(),
});

export const apAgingQuerySchema = z.object({
	asOfDate: isoDate.optional(),
	supplierCompanyId: z.string().uuid().optional(),
});

export const arAgingQuerySchema = z.object({
	asOfDate: isoDate.optional(),
	customerId: z.string().uuid().optional(),
});

/* ----------------------------- reports (F6) ----------------------------- */

export const profitAndLossQuerySchema = z
	.object({
		startDate: isoDate,
		endDate: isoDate,
	})
	.refine((q) => q.startDate <= q.endDate, {
		message: 'startDate must not be after endDate',
	});

export const balanceSheetQuerySchema = z.object({
	asOfDate: isoDate,
});

export const cashFlowQuerySchema = z
	.object({
		startDate: isoDate,
		endDate: isoDate,
	})
	.refine((q) => q.startDate <= q.endDate, {
		message: 'startDate must not be after endDate',
	});

/* ----------------------------- bank reconciliation (F6) ----------------------------- */

export const reconciliationCreateSchema = z.object({
	cashBankAccountId: z.string().uuid(),
	reconciliationDate: isoDate,
	statementBalance: minorAmount,
	notes: z.string().nullish().transform((v) => v ?? null),
});

export const reconciliationListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	cashBankAccountId: z.string().uuid().optional(),
	status: z
		.enum(['draft', 'in_progress', 'reconciled', 'closed'])
		.optional(),
});

export const reconciliationItemSchema = z.object({
	cashBankTransactionId: z.string().uuid().nullish().transform((v) => v ?? null),
	statementReference: z.string().nullish().transform((v) => v ?? null),
	statementAmount: minorAmount.nullish().transform((v) => v ?? null),
	notes: z.string().nullish().transform((v) => v ?? null),
});

export const reconciliationItemsSchema = z.object({
	items: z.array(reconciliationItemSchema).min(1).max(500),
});

export const reconciliationMatchSchema = z.object({
	cashBankTransactionId: z.string().uuid().nullish().transform((v) => v ?? null),
});

/* ----------------------------- month-end close (F7) ----------------------------- */

export const closeChecklistQuerySchema = z.object({
	periodYear: z.coerce.number().int().min(2000).max(2100),
	periodMonth: z.coerce.number().int().min(1).max(12),
});

/* ----------------------------- report archive (M12 T30) ----------------------------- */

export const reportArchiveListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
	periodMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export const reportArchiveCreateSchema = z.object({
	periodYear: z.number().int().min(2000).max(2100),
	periodMonth: z.number().int().min(1).max(12),
});

export const paymentVoidSchema = z.object({
	reason: z.string().min(1),
});

/** AR aging bucket in days past due. */
export type TAgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90plus';

export const AGING_BUCKETS: readonly TAgingBucket[] = [
	'current',
	'd1_30',
	'd31_60',
	'd61_90',
	'd90plus',
] as const;