import { z } from 'zod';
import { organizationRoleSchema } from '@ims-erp/common';
import {
	EMPLOYMENT_STATUSES,
	EMPLOYMENT_TYPES,
	WORK_TYPES,
	type TEmployeeSelect,
} from '@drizzle/schemas/human-resource.schema';
import type { TPaginationResult } from '@ims-erp/common';

/**
 * Request schemas for the employee API (`/hr/employees`, ERP-0034).
 *
 * @remarks
 * Parsed at the controller boundary before any service call. Business dates
 * are Jakarta `YYYY-MM-DD` strings, stored as instants at midnight.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

/** Identity/contact fields a caller can set on create and update. */
export const employeeBaseSchema = z.object({
	employeeCode: z
		.string()
		.trim()
		.max(32)
		.nullish()
		.transform((value) => (value ? value : null)),
	fullName: z.string().trim().min(1).max(200),
	legalName: optionalText(200),
	nickname: optionalText(100),
	gender: z.enum(['male', 'female']).nullish(),
	birthDate: z.iso.date().nullish(),
	birthPlace: optionalText(200),
	nationalId: optionalText(32),
	maritalStatus: z
		.enum(['single', 'married', 'divorced', 'widowed'])
		.nullish(),
	email: z.email().max(320).nullish(),
	phone: optionalText(100),
	whatsapp: optionalText(100),
	employmentStatus: z.enum(EMPLOYMENT_STATUSES).default('active'),
	employmentType: z.enum(EMPLOYMENT_TYPES).default('permanent'),
	workType: z.enum(WORK_TYPES).default('onsite'),
	hireDate: z.iso.date().nullish(),
	terminationDate: z.iso.date().nullish(),
	managerEmployeeId: z.uuid().nullish(),
});

/** Invite-first creation: employee fields plus the invitation payload. */
export const createEmployeeSchema = employeeBaseSchema.extend({
	/** Target organization; omit for a company-level employee (admins only). */
	organizationId: z.string().min(1).nullish(),
	/** Organization roles granted on claim (org path only; default `member`). */
	organizationRoles: z.array(organizationRoleSchema).min(1).optional(),
});

/** Patch: everything optional, identity columns never change here. */
export const updateEmployeeSchema = employeeBaseSchema.partial().extend({
	employeeCode: z
		.string()
		.trim()
		.min(1)
		.max(32)
		.nullish()
		.transform((value) => (value ? value : null)),
});

export const employeeListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(EMPLOYMENT_STATUSES).optional(),
	organizationId: z.string().min(1).optional(),
	/** `company` selects only company-level (`organization_id IS NULL`). */
	scope: z.enum(['all', 'organization', 'company']).default('all'),
});

export const idParamSchema = z.object({ id: z.uuid() });

/** Picker query: warehouse form asks for candidates of the linked orgs. */
export const employeePickerQuerySchema = z.object({
	organizationIds: z
		.string()
		.min(1)
		.transform((value) =>
			value
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean),
		),
	search: z.string().trim().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TCreateEmployee = z.output<typeof createEmployeeSchema>;
export type TUpdateEmployee = z.output<typeof updateEmployeeSchema>;
export type TEmployeeListQuery = z.output<typeof employeeListQuerySchema>;
export type TEmployeePickerQuery = z.output<typeof employeePickerQuerySchema>;

/** Picker row: minimal dropdown payload. */
export type TEmployeePickerRow = {
	id: string;
	employeeCode: string;
	fullName: string;
	organizationId: string | null;
};

/** Employee as the API returns it (dates as ISO strings). */
export type TEmployeeDto = TEmployeeSelect & {
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	birthDate: string | null;
	hireDate: string | null;
	terminationDate: string | null;
};

export type TEmployeePage = TPaginationResult<TEmployeeDto>;
