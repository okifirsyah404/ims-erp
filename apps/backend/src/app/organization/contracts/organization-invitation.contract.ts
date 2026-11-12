import { z } from 'zod';
import { erpRoleNames, organizationRoleSchema } from '@ims-erp/common';

/**
 * Request contracts for the organization-scoped invitation routes.
 *
 * @remarks
 * The organization module owns these shapes instead of importing the user
 * module's `invitation.contract.ts`: the org surface has no `organizationId`
 * in the body (it comes from the path, so a caller can never invite into an
 * organization it was not authorized for) and no app-level variant at all.
 * Both modules validate the same rules; only the boundary differs.
 */

/** Body row for an organization invitation. `name` is required. */
export const orgInvitationRowSchema = z.object({
	email: z.email().max(320),
	/** Prefills the pre-created user and the claim profile form. */
	name: z.string().min(1).max(120),
	/**
	 * Closed ERP role enum list; the service defaults to `['member']`.
	 * Stored comma-joined (ERP-0041 multi-role).
	 */
	organizationRoles: z
		.array(organizationRoleSchema)
		.min(1)
		.max(erpRoleNames.length)
		.optional(),
});
/** Parsed {@link orgInvitationRowSchema}. */
export type TOrgInvitationRow = z.infer<typeof orgInvitationRowSchema>;

/** Single invite or a bulk batch (cap 100, matching the shared pipeline). */
export const createOrgInvitationSchema = z.union([
	orgInvitationRowSchema,
	z.array(orgInvitationRowSchema).min(1).max(100),
]);

/** Path params for the collection routes. */
export const orgInvitationListParamsSchema = z.object({
	organizationId: z.string().min(1),
});

/** Path params for the id-targeted routes. */
export const orgInvitationParamsSchema = z.object({
	organizationId: z.string().min(1),
	invitationId: z.string().min(1),
});

/** Query for the organization's pending-invitation table. */
export const orgInvitationQuerySchema = z.object({
	status: z.enum(['pending', 'accepted', 'cancelled', 'expired']).optional(),
	email: z.string().min(1).optional(),
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});
