import { z } from 'zod';
import { erpRoleNames } from '@ims-erp/common';

/**
 * Request/response contracts for the organization module's first-party API.
 *
 * @remarks
 * Organizations and members are Better Auth–owned rows (`auth.organizations`,
 * `auth.members`). Mutations flow through the Better Auth organization API
 * (via the auth gateway) while `deletedAt` soft-delete state is owned by the
 * organization repository — mirroring the user module split.
 */

/** Roles assignable to a member, straight from the shared role catalog. */
export const memberRoleSchema = z.enum(erpRoleNames);
export type TMemberRole = z.infer<typeof memberRoleSchema>;

export const createOrganizationSchema = z.object({
	name: z.string().min(1).max(200),
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase alphanumeric and dashes'),
	logo: z.string().url().max(2048).nullish(),
	metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type TCreateOrganization = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		logo: z.string().url().max(2048).nullish(),
		metadata: z.record(z.string(), z.unknown()).nullish(),
	})
	.refine(
		(v) =>
			v.name !== undefined || v.logo !== undefined || v.metadata !== undefined,
		{ message: 'At least one field is required' },
	);
export type TUpdateOrganization = z.infer<typeof updateOrganizationSchema>;

export const organizationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	includeDeleted: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.optional(),
});
export type TOrganizationQuery = z.infer<typeof organizationQuerySchema>;

export const organizationIdParamsSchema = z.object({
	organizationId: z.string().min(1),
});

export const memberQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	role: memberRoleSchema.optional(),
});
export type TMemberQuery = z.infer<typeof memberQuerySchema>;

export const addMemberSchema = z.object({
	userId: z.string().min(1),
	role: memberRoleSchema,
});
export type TAddMember = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
	role: memberRoleSchema,
});
export type TUpdateMemberRole = z.infer<typeof updateMemberRoleSchema>;

export const memberIdParamsSchema = z.object({
	organizationId: z.string().min(1),
	memberId: z.string().min(1),
});

/** Member row joined with the user's identity fields for display. */
export type TOrganizationMember = {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
	createdAt: Date;
	user: {
		name: string;
		email: string;
		image: string | null;
	} | null;
};
