import type {
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
	whatsapp: z.string().max(30).optional().nullable(),
	website: z.string().max(200).optional().nullable(),
	paymentTermsDays: z.coerce.number().int().min(0).default(0),
	paymentTermNote: z.string().max(300).optional().nullable(),
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
	whatsapp: z.string().max(30).optional().nullable(),
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

/** One supplier company with its people, the detail view. */
export type TSupplierCompanyView = TSupplierCompanySelect & {
	people: TSupplierSelect[];
};
