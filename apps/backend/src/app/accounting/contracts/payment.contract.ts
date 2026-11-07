import { z } from 'zod';
import { isoDate, minorAmount } from './ledger.contract';

/* ----------------------------- payments (F4) ----------------------------- */

export const paymentCreateSchema = z.object({
	paymentType: z
		.enum(['customer_payment', 'supplier_payment'])
		.default('customer_payment'),
	counterpartyType: z
		.enum(['customer', 'supplier'])
		.nullish()
		.transform((v) => v ?? null),
	counterpartyId: z.string().uuid().nullish().transform((v) => v ?? null),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	paymentMethod: z
		.enum(['bank_transfer', 'cash', 'cheque', 'virtual_account'])
		.default('bank_transfer'),
	paymentDate: isoDate,
	cashBankAccountId: z.string().uuid().nullish().transform((v) => v ?? null),
	referenceNumber: z.string().nullish().transform((v) => v ?? null),
	notes: z.string().nullish().transform((v) => v ?? null),
	/** Optional initial allocations (validated, stored while draft). */
	allocations: z
		.array(
			z.object({
				salesInvoiceId: z.string().uuid().optional(),
				supplierBillId: z.string().uuid().optional(),
				amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
			}),
		)
		.max(100)
		.default([]),
});

export const paymentAllocationsSchema = z.object({
	allocations: z
		.array(
			z.object({
				salesInvoiceId: z.string().uuid().optional(),
				supplierBillId: z.string().uuid().optional(),
				amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
			}),
		)
		.min(1)
		.max(100),
});

export const paymentListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z
		.enum(['draft', 'submitted', 'approved', 'executed', 'void'])
		.optional(),
	paymentType: z.enum(['customer_payment', 'supplier_payment']).optional(),
});

/* ----------------------------- supplier bills (F5) ----------------------------- */

export const supplierBillCreateSchema = z.object({
	supplierId: z.string().uuid(),
	purchaseOrderId: z.string().uuid().nullish().transform((v) => v ?? null),
	billDate: isoDate,
	dueDate: isoDate.nullish().transform((v) => v ?? null),
	subtotal: minorAmount,
	taxTotal: minorAmount.default(0),
	currencyCode: z.string().length(3).default('IDR'),
	notes: z.string().nullish().transform((v) => v ?? null),
});

export const supplierBillListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z
		.enum(['draft', 'approved', 'partially_paid', 'paid', 'overdue', 'void'])
		.optional(),
	supplierId: z.string().uuid().optional(),
});

export const apAgingQuerySchema = z.object({
	asOfDate: isoDate.optional(),
	supplierId: z.string().uuid().optional(),
});

export const arAgingQuerySchema = z.object({
	asOfDate: isoDate.optional(),
	customerId: z.string().uuid().optional(),
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
