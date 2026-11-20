import { z } from 'zod';
import { PAYABLE_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, PAYMENT_TYPES } from '@drizzle/schemas/payment.schema';

/**
 * HTTP contracts of the payment module (ADR-0024 Q18).
 *
 * @remarks
 * A payment settles payables through allocations of `{ payableType, payableId,
 * amount }`; one payment may settle several payables and one payable may
 * receive several payments (staged settlement). The service currently resolves
 * `sale_invoice` and `supplier_bill`; the other payable types wait for their
 * owning module's exported service.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const minorAmount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const paymentAllocationInputSchema = z.object({
	payableType: z.enum(PAYABLE_TYPES),
	payableId: z.string().min(1).max(64),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const paymentCreateSchema = z.object({
	paymentType: z.enum(['receipt', 'disbursement']).default('receipt'),
	counterpartyType: z
		.enum(['customer', 'supplier'])
		.nullish()
		.transform((v) => v ?? null),
	counterpartyId: z.string().min(1).nullish().transform((v) => v ?? null),
	amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	paymentMethod: z.enum(PAYMENT_METHODS).default('bank_transfer'),
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
	status: z.enum(PAYMENT_STATUSES).optional(),
	paymentType: z.enum(PAYMENT_TYPES).optional(),
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
