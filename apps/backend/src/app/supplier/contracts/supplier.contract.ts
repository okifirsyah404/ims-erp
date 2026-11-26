import type {
	TSupplierAddressSelect,
	TSupplierCompanyAddressSelect,
	TSupplierCompanySelect,
	TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { z } from 'zod';

/* ------------------------------------------------------------------------ *
 * Companies
 * ------------------------------------------------------------------------ */

export const supplierCompanyCreateSchema = z.object({
	/**
	 * Optional on create: left empty, the code is generated from
	 * `supplier.code_numberings` (default `{COMPANY}-{ORG}-{TYPE}-{SEQ:5}`). A
	 * typed code is kept as-is, so a short supplier code for the PO `{SUPPLIER}`
	 * token stays possible.
	 */
	code: z.preprocess(
		(value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
		z.string().trim().min(2).max(32).optional(),
	),
	name: z.string().min(1).max(200),
	legalName: z.string().max(200).optional().nullable(),
	supplierType: z.enum(['company', 'government']).default('company'),
	taxId: z.string().max(16).optional().nullable(),
	email: z.string().email().optional().nullable(),
	phone: z.string().max(30).optional().nullable(),
	website: z.string().max(200).optional().nullable(),
	bankName: z.string().max(200).optional().nullable(),
	bankAccountNumber: z.string().max(100).optional().nullable(),
	bankAccountHolder: z.string().max(200).optional().nullable(),
	notes: z.string().optional().nullable(),
});

/** Parsed create input for a supplier company. */
export type TSupplierCompanyCreateInput = z.infer<
	typeof supplierCompanyCreateSchema
>;

export const supplierCompanyUpdateSchema =
	supplierCompanyCreateSchema.partial();

/** Parsed update input for a supplier company. */
export type TSupplierCompanyUpdateInput = z.infer<
	typeof supplierCompanyUpdateSchema
>;

export const supplierCompanyListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().min(1).optional(),
	status: z.enum(['active', 'inactive']).optional(),
	sortBy: z.enum(['name', 'code', 'createdAt']).default('name'),
	sortDir: z.enum(['asc', 'desc']).default('asc'),
});

/** Parsed list query for supplier companies. */
export type TSupplierCompanyListQuery = z.infer<
	typeof supplierCompanyListQuerySchema
>;

/* ------------------------------------------------------------------------ *
 * People (PIC)
 * ------------------------------------------------------------------------ */

export const supplierCreateSchema = z.object({
	companyId: z.string().uuid().optional().nullable(),
	name: z.string().min(1).max(200),
	title: z.string().max(100).optional().nullable(),
	phone: z.string().max(30).optional().nullable(),
	email: z.string().email().optional().nullable(),
	isPrimary: z.boolean().default(false),
});

/** Parsed create input for a supplier person. */
export type TSupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export const supplierUpdateSchema = supplierCreateSchema.partial();

/** Parsed update input for a supplier person. */
export type TSupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export const supplierListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	companyId: z.string().uuid().optional(),
});

/** Parsed list query for supplier people. */
export type TSupplierListQuery = z.infer<typeof supplierListQuerySchema>;

/** Paginated supplier companies, the response of `GET /suppliers/companies`. */
export type TSupplierCompanyPaginated = TPaginationResult<
	TSupplierCompanySelect[]
>;

/** Paginated supplier people, the response of `GET /suppliers/people`. */
export type TSupplierPaginated = TPaginationResult<TSupplierSelect[]>;

/* ------------------------------------------------------------------------ *
 * Addresses (person + company)
 * ------------------------------------------------------------------------ */

export const supplierCompanyAddressSchema = z
	.object({
		kind: z
			.enum(['office', 'factory', 'warehouse', 'billing', 'other'])
			.default('office'),
		label: z.string().trim().max(100).optional().nullable(),
		contactName: z.string().trim().max(200).optional().nullable(),
		contactPhone: z.string().trim().max(30).optional().nullable(),
		addressLine: z.string().trim().min(1).max(500),
		/** Village of `location.villages`; validated through the location contract. */
		villageId: z.uuid().nullish().transform((value) => value ?? null),
		postalCode: z
			.string()
			.trim()
			.regex(/^[0-9]{0,10}$/)
			.nullish()
			.transform((value) => (value ? value : null)),
		isPrimary: z.boolean().default(false),
	})
	.strict();

/** Parsed create input for a supplier company address. */
export type TSupplierCompanyAddressInput = z.output<
	typeof supplierCompanyAddressSchema
>;

export const updateSupplierCompanyAddressSchema =
	supplierCompanyAddressSchema.partial().strict();

/** Parsed update input for a supplier company address. */
export type TUpdateSupplierCompanyAddressInput = z.output<
	typeof updateSupplierCompanyAddressSchema
>;

export const supplierAddressSchema = z
	.object({
		kind: z.enum(['office', 'other']).default('office'),
		label: z.string().trim().max(100).optional().nullable(),
		addressLine: z.string().trim().min(1).max(500),
		villageId: z.uuid().nullish().transform((value) => value ?? null),
		postalCode: z
			.string()
			.trim()
			.regex(/^[0-9]{0,10}$/)
			.nullish()
			.transform((value) => (value ? value : null)),
		isPrimary: z.boolean().default(false),
	})
	.strict();

/** Parsed create input for a supplier person address. */
export type TSupplierAddressInput = z.output<typeof supplierAddressSchema>;

export const updateSupplierAddressSchema =
	supplierAddressSchema.partial().strict();

/** Parsed update input for a supplier person address. */
export type TUpdateSupplierAddressInput = z.output<
	typeof updateSupplierAddressSchema
>;

/** Two-level address param: the owner id and the address id. */
export const supplierAddressParamSchema = z.object({
	id: z.string().uuid(),
	addressId: z.string().uuid(),
});

/** One supplier company with its people and addresses, the detail view. */
export type TSupplierCompanyView = TSupplierCompanySelect & {
	people: TSupplierSelect[];
	addresses: TSupplierCompanyAddressSelect[];
};
