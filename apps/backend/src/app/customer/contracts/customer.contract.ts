import { z } from 'zod';

/* ------------------------------------------------------------------------ *
 * Shared field schemas
 * ------------------------------------------------------------------------ */

/**
 * Request field schemas for the customer endpoints (`/customers`).
 *
 * @remarks
 * Parsed at the controller boundary. Empty strings from forms become `null`;
 * codes are upper-cased; NPWP keeps digits only.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const phoneSchema = z
	.string()
	.trim()
	.max(30)
	.regex(/^[0-9+()\-\s]*$/)
	.nullish()
	.transform((value) => (value ? value : null));

const emailSchema = z
	.union([z.literal(''), z.email().max(254)])
	.nullish()
	.transform((value) => (value ? value.toLowerCase() : null));

/** NPWP: formatting characters are stripped; 15 (legacy) or 16 digits. */
const taxIdSchema = z
	.string()
	.nullish()
	.transform((value) => (value ?? '').replace(/[^0-9]/g, ''))
	.refine(
		(value) =>
			value.length === 0 || value.length === 15 || value.length === 16,
	)
	.transform((value) => (value.length === 0 ? null : value));

const codeSchema = z
	.string()
	.trim()
	.min(1)
	.max(32)
	.regex(/^[A-Za-z0-9._\-/]+$/)
	.transform((value) => value.toUpperCase());

/**
 * Code on create: optional. Empty or omitted, the service generates it from
 * `customer.code_numberings`; a typed code is kept (upper-cased).
 */
const createCodeSchema = z.preprocess(
	(value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
	codeSchema.optional(),
);

/* ------------------------------------------------------------------------ *
 * Companies
 * ------------------------------------------------------------------------ */

export const createCompanySchema = z
	.object({
		code: createCodeSchema,
		companyType: z.enum(['company', 'government', 'partner']).default('company'),
		name: z.string().trim().min(1).max(200),
		legalName: optionalText(200),
		taxId: taxIdSchema,
		email: emailSchema,
		phone: phoneSchema,
		whatsapp: phoneSchema,
		website: optionalText(200),
		status: z.enum(['active', 'inactive']).default('active'),
		notes: optionalText(2000),
	})
	.strict();

/** Parsed create input for a customer company. */
export type TCreateCompanyInput = z.output<typeof createCompanySchema>;

// Update keeps the code strict: an existing code is changed, never regenerated.
export const updateCompanySchema = createCompanySchema
	.partial()
	.extend({ code: codeSchema.optional() })
	.strict();

/** Parsed update input for a customer company. */
export type TUpdateCompanyInput = z.output<typeof updateCompanySchema>;

export const companyListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(['active', 'inactive']).optional(),
	companyType: z.enum(['company', 'government', 'partner']).optional(),
});

/** Parsed list query for customer companies. */
export type TCompanyListQuery = z.output<typeof companyListQuerySchema>;

/* ------------------------------------------------------------------------ *
 * People (customers)
 * ------------------------------------------------------------------------ */

export const createCustomerSchema = z
	.object({
		code: createCodeSchema,
		companyId: z.uuid().nullish().transform((value) => value ?? null),
		customerType: z.enum(['individual', 'contact']).default('individual'),
		name: z.string().trim().min(1).max(200),
		position: optionalText(100),
		email: emailSchema,
		phone: phoneSchema,
		whatsapp: phoneSchema,
		isPrimary: z.boolean().default(false),
		notes: optionalText(2000),
	})
	.strict();

/** Parsed create input for a customer person. */
export type TCreateCustomerInput = z.output<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema
	.partial()
	.extend({ code: codeSchema.optional() })
	.strict();

/** Parsed update input for a customer person. */
export type TUpdateCustomerInput = z.output<typeof updateCustomerSchema>;

export const customerListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(['active', 'inactive']).optional(),
	customerType: z.enum(['individual', 'contact']).optional(),
	companyId: z.uuid().optional(),
});

/** Parsed list query for customer people. */
export type TCustomerListQuery = z.output<typeof customerListQuerySchema>;

/* ------------------------------------------------------------------------ *
 * Addresses
 * ------------------------------------------------------------------------ */

/** Q10 address shape: only `village_id` is stored. */
export const companyAddressSchema = z
	.object({
		kind: z.enum(['billing', 'shipping', 'service', 'site', 'other']).default('billing'),
		label: optionalText(100),
		contactName: optionalText(200),
		contactPhone: phoneSchema,
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

/** Parsed create input for a company address. */
export type TCompanyAddressInput = z.output<typeof companyAddressSchema>;

export const updateCompanyAddressSchema =
	companyAddressSchema.partial().strict();

/** Parsed update input for a company address. */
export type TUpdateCompanyAddressInput = z.output<
	typeof updateCompanyAddressSchema
>;

/** Address of a person. */
export const customerAddressSchema = z
	.object({
		kind: z.enum(['residence', 'office', 'billing', 'other']).default('residence'),
		label: optionalText(100),
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

/** Parsed create input for a person address. */
export type TCustomerAddressInput = z.output<typeof customerAddressSchema>;

export const updateCustomerAddressSchema =
	customerAddressSchema.partial().strict();

/** Parsed update input for a person address. */
export type TUpdateCustomerAddressInput = z.output<
	typeof updateCustomerAddressSchema
>;

/* ------------------------------------------------------------------------ *
 * Portal accounts
 * ------------------------------------------------------------------------ */

/** Roles a portal login may hold for its company (owner decision D2). */
export const portalRoleSchema = z.enum(['owner', 'approver', 'finance', 'viewer']);

/** Staff invite of a portal login for a company person. */
export const portalInviteSchema = z
	.object({
		customerId: z.uuid(),
		role: portalRoleSchema.default('owner'),
	})
	.strict();

/** Parsed staff invite input. */
export type TPortalInviteInput = z.output<typeof portalInviteSchema>;

/** Owner invite of a colleague (person of the same company). */
export const portalMemberInviteSchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		email: z.email().max(254),
		role: portalRoleSchema.default('viewer'),
	})
	.strict();

/** Parsed owner invite input. */
export type TPortalMemberInviteInput = z.output<
	typeof portalMemberInviteSchema
>;

/* ------------------------------------------------------------------------ *
 * Params
 * ------------------------------------------------------------------------ */

export const idParamSchema = z.object({ id: z.uuid() });
export const addressParamSchema = z.object({
	id: z.uuid(),
	addressId: z.uuid(),
});
