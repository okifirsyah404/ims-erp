import { z } from 'zod';
import { CUSTOMER_STATUSES, CUSTOMER_TYPES } from '@drizzle/schemas/crm.schema';

/**
 * Request schemas for the customer endpoints (`/customers`).
 *
 * @remarks
 * Parsed at the controller boundary. Empty strings from forms become
 * `null`; codes are upper-cased; NPWP keeps digits only.
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
	.refine((value) => value.length === 0 || value.length === 15 || value.length === 16)
	.transform((value) => (value.length === 0 ? null : value));

const codeSchema = z
	.string()
	.trim()
	.min(1)
	.max(32)
	.regex(/^[A-Za-z0-9._\-/]+$/)
	.transform((value) => value.toUpperCase());

export const createCustomerSchema = z
	.object({
		code: codeSchema,
		customerType: z.enum(CUSTOMER_TYPES),
		name: z.string().trim().min(1).max(200),
		legalName: optionalText(200),
		taxId: taxIdSchema,
		email: emailSchema,
		phone: phoneSchema,
		whatsapp: phoneSchema,
		addressLine: optionalText(500),
		villageId: z.uuid().nullish().transform((value) => value ?? null),
		postalCode: z
			.string()
			.trim()
			.regex(/^[0-9]{0,10}$/)
			.nullish()
			.transform((value) => (value ? value : null)),
		notes: optionalText(2000),
	})
	.strict();

export const updateCustomerSchema = createCustomerSchema.partial().strict();

export const customerListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(CUSTOMER_STATUSES).optional(),
	customerType: z.enum(CUSTOMER_TYPES).optional(),
});

export const customerContactSchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		position: optionalText(100),
		email: emailSchema,
		phone: phoneSchema,
		whatsapp: phoneSchema,
		isPrimary: z.boolean().default(false),
	})
	.strict();

export const updateCustomerContactSchema = customerContactSchema.partial().strict();

export const idParamSchema = z.object({ id: z.uuid() });
export const contactParamSchema = z.object({ id: z.uuid(), contactId: z.uuid() });

export type TCreateCustomerInput = z.output<typeof createCustomerSchema>;
export type TUpdateCustomerInput = z.output<typeof updateCustomerSchema>;
export type TCustomerListQuery = z.output<typeof customerListQuerySchema>;
export type TCreateContactInput = z.output<typeof customerContactSchema>;
export type TUpdateContactInput = z.output<typeof updateCustomerContactSchema>;
