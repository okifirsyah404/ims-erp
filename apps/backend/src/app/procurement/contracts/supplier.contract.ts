import { z } from 'zod';
import { SUPPLIER_STATUSES, SUPPLIER_TYPES } from '@drizzle/schemas/procurement.schema';

/**
 * Request schemas for the supplier endpoints (`/suppliers`, ADR-0011 step
 * 4a). Empty strings become `null`; codes are upper-cased; NPWP keeps
 * digits only.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const phone = z
	.string()
	.trim()
	.max(30)
	.regex(/^[0-9+()\-\s]*$/)
	.nullish()
	.transform((value) => (value ? value : null));

const email = z
	.union([z.literal(''), z.email().max(254)])
	.nullish()
	.transform((value) => (value ? value.toLowerCase() : null));

const taxId = z
	.string()
	.nullish()
	.transform((value) => (value ?? '').replace(/[^0-9]/g, ''))
	.refine((value) => value.length === 0 || value.length === 15 || value.length === 16)
	.transform((value) => (value.length === 0 ? null : value));

/** Letters and digits only: it is the `{SUPPLIER}` token of PO numbers. */
const code = z
	.string()
	.trim()
	.min(1)
	.max(32)
	.regex(/^[A-Za-z0-9]+$/)
	.transform((value) => value.toUpperCase());

const supplierFields = {
	code,
	supplierType: z.enum(SUPPLIER_TYPES),
	name: z.string().trim().min(1).max(200),
	legalName: optionalText(200),
	taxId,
	email,
	phone,
	whatsapp: phone,
	website: optionalText(200),
	addressLine: optionalText(500),
	villageId: z.uuid().nullish().transform((value) => value ?? null),
	postalCode: z
		.string()
		.trim()
		.regex(/^[0-9]{0,10}$/)
		.nullish()
		.transform((value) => (value ? value : null)),
	picName: optionalText(120),
	picTitle: optionalText(100),
	picPhone: phone,
	picEmail: email,
	paymentTermsDays: z.number().int().min(0).max(365).default(0),
	paymentTermNote: optionalText(300),
	bankName: optionalText(100),
	bankAccountNumber: optionalText(40),
	bankAccountHolder: optionalText(150),
	notes: optionalText(2000),
};

export const createSupplierSchema = z.object(supplierFields).strict();
export const updateSupplierSchema = z.object(supplierFields).partial().strict();

export const supplierListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(SUPPLIER_STATUSES).optional(),
});

export const idParamSchema = z.object({ id: z.uuid() });

export type TCreateSupplierInput = z.output<typeof createSupplierSchema>;
export type TUpdateSupplierInput = z.output<typeof updateSupplierSchema>;
export type TSupplierListQuery = z.output<typeof supplierListQuerySchema>;

/** Bank columns, returned and accepted only with `supplier:read_bank`. */
export const SUPPLIER_BANK_FIELDS = ['bankName', 'bankAccountNumber', 'bankAccountHolder'] as const;
