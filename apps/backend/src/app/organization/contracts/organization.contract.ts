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
/** Parsed {@link memberRoleSchema}. */
export type TMemberRole = z.infer<typeof memberRoleSchema>;

/** Body for creating an organization. `slug` must be kebab-case. */
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
/** Parsed {@link createOrganizationSchema}. */
export type TCreateOrganization = z.infer<typeof createOrganizationSchema>;

/**
 * Body for partial organization updates. At least one field is required;
 * `slug` is intentionally immutable after creation.
 */
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
/** Parsed {@link updateOrganizationSchema}. */
export type TUpdateOrganization = z.infer<typeof updateOrganizationSchema>;

/**
 * Organization listing query. `includeDeleted` is a string enum because it
 * arrives as a query parameter; it is transformed to a real boolean.
 */
export const organizationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	includeDeleted: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.optional(),
});
/** Parsed {@link organizationQuerySchema}. */
export type TOrganizationQuery = z.infer<typeof organizationQuerySchema>;

/** Path parameters identifying an organization by id. */
export const organizationIdParamsSchema = z.object({
	organizationId: z.string().min(1),
});

/**
 * Member listing query: pagination plus an optional exact role filter.
 */
export const memberQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	role: memberRoleSchema.optional(),
});
/** Parsed {@link memberQuerySchema}. */
export type TMemberQuery = z.infer<typeof memberQuerySchema>;

/** Body for adding a member to an organization. */
export const addMemberSchema = z.object({
	userId: z.string().min(1),
	role: memberRoleSchema,
});
/** Parsed {@link addMemberSchema}. */
export type TAddMember = z.infer<typeof addMemberSchema>;

/** Body for changing a member's role (single-role overwrite). */
export const updateMemberRoleSchema = z.object({
	role: memberRoleSchema,
});
/** Parsed {@link updateMemberRoleSchema}. */
export type TUpdateMemberRole = z.infer<typeof updateMemberRoleSchema>;

/** Path parameters identifying one member within an organization. */
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
