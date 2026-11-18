import { z } from 'zod';

/**
 * HTTP contracts of the payment module (ADR-0024).
 *
 * @remarks
 * Moved here from `accounting` with the ledger itself. The routes and payload
 * shapes are unchanged, so the web admin needs no change.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const minorAmount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const paymentAllocationInputSchema = z.object({
	salesInvoiceId: z.string().uuid().optional(),
	supplierBillId: z.string().uuid().optional(),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const paymentCreateSchema = z.object({
	paymentType: z.enum(['customer_payment', 'supplier_payment']).default('customer_payment'),
	counterpartyType: z
		.enum(['customer', 'supplier'])
		.nullish()
		.transform((v) => v ?? null),
	counterpartyId: z.string().uuid().nullish().transform((v) => v ?? null),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	paymentMethod: z.enum(['bank_transfer', 'cash', 'cheque', 'virtual_account']).default('bank_transfer'),
	paymentDate: isoDate,
	cashBankAccountId: z.string().uuid().nullish().transform((v) => v ?? null),
	referenceNumber: z.string().nullish().transform((v) => v ?? null),
	notes: z.string().nullish().transform((v) => v ?? null),
	/** Optional initial allocations (validated, stored while draft). */
	allocations: z.array(paymentAllocationInputSchema).max(100).default([]),
});

export const paymentAllocationsSchema = z.object({
	allocations: z.array(paymentAllocationInputSchema).min(1).max(100),
});

export const paymentListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	status: z.enum(['draft', 'submitted', 'approved', 'executed', 'void']).optional(),
	paymentType: z.enum(['customer_payment', 'supplier_payment']).optional(),
});

export const paymentVoidSchema = z.object({
	reason: z.string().min(1),
});

export const paymentVoidExecutedSchema = z.object({
	reason: z.string().min(1),
});

export const paymentIdParamSchema = z.object({ id: z.string().uuid() });

export type TPaymentCreateInput = z.output<typeof paymentCreateSchema>;
export type TPaymentListQuery = z.output<typeof paymentListQuerySchema>;
export type TPaymentAllocationInput = z.output<typeof paymentAllocationInputSchema>;

/** Composition helper so callers keep the minor-unit vocabulary explicit. */
export { minorAmount as paymentMinorAmount };
